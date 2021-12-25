import { Readable } from "stream";
import fs from "fs";

import * as codec from "@ipld/dag-cbor";
import { sha256 as hasher } from "multiformats/hashes/sha2";
import { CID } from "multiformats";
import { CarWriter } from "@ipld/car";


import * as BTreeMap from "chunky-trees/map";
import { bf, simpleCompare as compare } from "chunky-trees/utils";
import { nocache } from "chunky-trees/cache";


// ============================================================================
export class URLIndex
{
  constructor(storage) {
    this.root = null;

    this.storage = storage;

    //const cache = global;
    const cache = nocache;
    const chunker = bf(3);
    const get = (x) => this.storage.get(x);

    this.btreeOpts = { get, compare, cache, chunker, codec, hasher };
  }

  get rootCid() {
    return this.root ? this.root.block.cid : null;
  }

  async createNew(info) {
    await this._createTree([{key: "@root", value: JSON.stringify(info)}]);
    return this.rootCid;
  }

  async _createTree(list) {
    for await (const node of BTreeMap.create({ list, ...this.btreeOpts })) {
      await this.storage.put(await node.block);
      this.root = node;
    }
  }

  async loadExisting(cid) {
    this.root = await BTreeMap.load({cid, ...this.btreeOpts});
  }

  async add(key, value) {
    if (typeof(value) === "string") {
      value = CID.parse(value);
    }
    await this._insertTree([{key, value}]);
    return this.rootCid;
  }

  async _insertTree(bulk) {
    const newtree = await this.root.bulk(bulk);
    await Promise.all(newtree.blocks.map(block => this.storage.put(block)));
    this.root = newtree.root;
  }

  prefixUpperBound(url) {
    return url.slice(0, -1) + String.fromCharCode(url.charCodeAt(url.length - 1) + 1);
  }

  async query({url, matchType = "exact"} = {}) {
    let start;
    let end;

    if (!url) {
      return [];
    }

    switch (matchType) {
    case "prefix":
      start = url;
      end = this.prefixUpperBound(url);
      break;
 
    case "exact":
    default:
      start = url;
      end = url + "!";
    }

    const res = await this.root.getRangeEntries(start, end);

    return res.result.map((entry) => {return {url: entry.key, cid: entry.value.toString()};});
  }

  async serializeToCar(filename) {
    const { writer, out } = await CarWriter.create([this.root.block.cid]);
    //const { writer, out } = await CarWriter.create(Array.from(this.storage.cids.values()));

    const writable = fs.createWriteStream(filename);

    const p = new Promise(resolve => {
      writable.once("finish", () => resolve());
    });
    
    Readable.from(out).pipe(writable);

    for (const cid of this.storage.cids) {
      const block = await this.storage.get(cid);
      await writer.put(block);
    }

    await writer.close();
    await p;
  }
}

