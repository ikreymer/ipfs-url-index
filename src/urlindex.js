//import { Readable } from "stream";
//import fs from "fs";

import * as codec from "@ipld/dag-cbor";
import { sha256 as hasher } from "multiformats/hashes/sha2";
//import { CID } from "multiformats";

import * as BTreeMap from "chunky-trees/map";
import { bf, simpleCompare as compare } from "chunky-trees/utils";
import { nocache } from "chunky-trees/cache";

// ============================================================================
export class URLIndex {
  constructor(storage) {
    this.root = null;

    this.storage = storage;

    //const cache = global;
    const cache = nocache;
    const chunker = bf(3);
    const get = (x) => this.storage.get(x);

    this.btreeOpts = { get, compare, cache, chunker, codec, hasher };
  }

  _setRoot(root) {
    if (this.root && this.storage.ipfs) {
      this.storage.ipfs.pin.rm(this.root.block.cid);
    }

    this.root = root;

    if (this.root && this.storage.ipfs) {
      this.storage.ipfs.pin.add(this.root.block.cid);
    }
  }

  get rootCid() {
    return this.root ? this.root.block.cid : null;
  }

  async createNew(info) {
    await this._createTree([{ key: "@info", value: info }]);
    return this.rootCid;
  }

  async _createTree(list) {
    for await (const node of BTreeMap.create({ list, ...this.btreeOpts })) {
      await this.storage.put(await node.block);
      this._setRoot(node);
    }
  }

  async loadExisting(cid) {
    const root = await BTreeMap.load({ cid, ...this.btreeOpts });
    this._setRoot(root);
  }

  async add({ url, ts, cid, title = "" } = {}) {
    if (!cid || !url || !ts) {
      throw new Error("cid, url, ts must be provided");
    }

    const key = getSurt(url) + " " + ts;

    const value = { url, cid };
    if (title) {
      value.title = title;
    }

    const res = await this.root.getRangeEntries(key, key + "!");
    if (res && res.result.length) {
      console.log("already added!");
      return this.rootCid;
    }

    await this._insertTree([{ key, value }]);
    return this.rootCid;
  }

  async _insertTree(bulk) {
    const newtree = await this.root.bulk(bulk);
    await Promise.all(newtree.blocks.map((block) => this.storage.put(block)));
    this._setRoot(newtree.root);
  }

  prefixUpperBound(url) {
    return (
      url.slice(0, -1) + String.fromCharCode(url.charCodeAt(url.length - 1) + 1)
    );
  }

  async query({ url, matchType = "exact"} = {}) {
    let start;
    let end;

    if (!url) {
      return [];
    }

    switch (matchType) {
      case "raw-prefix":
        start = url;
        end = this.prefixUpperBound(start);
        break;

      case "all":
        start = "";
        end = "zzz";
        break;

      case "prefix":
        start = getSurt(url);
        end = this.prefixUpperBound(start);
        break;

      case "exact":
      default:
        start = getSurt(url);
        end = start + "!";
    }

    const res = await this.root.getRangeEntries(start, end);

    return res.result.map((entry) => {
      return { key: entry.key, ...entry.value };
    });
  }
}

export function getSurt(url) {
  try {
    if (!url.startsWith("https:") && !url.startsWith("http:")) {
      return url;
    }
    url = url.replace(/^(https?:\/\/)www\d*\./, "$1");
    const urlObj = new URL(url.toLowerCase());

    const hostParts = urlObj.hostname.split(".").reverse();
    let surt = hostParts.join(",");
    if (urlObj.port) {
      surt += ":" + urlObj.port;
    }
    surt += ")";
    surt += urlObj.pathname;
    if (urlObj.search) {
      urlObj.searchParams.sort();
      surt += urlObj.search;
    }
    return surt;
  } catch (e) {
    return url;
  }
}
