import { Readable } from 'stream';
import fs from "fs";

import tempy from 'tempy';

import * as codec from '@ipld/dag-cbor'
import * as Block from 'multiformats/block';
import * as IPFS from 'ipfs';
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { CID } from 'multiformats';
import { CarReader, CarWriter } from '@ipld/car';


import * as BTreeMap from 'chunky-trees/map'
import { bf, simpleCompare as compare } from 'chunky-trees/utils'
import { nocache, global } from 'chunky-trees/cache'


// ============================================================================
export class MemStorage
{
  constructor() {
    this.storage = {};
  }

  async get(cid) {
    const block = this.storage[cid.toString()];
    //console.log("getting: " + cid);

    if (!block) {
      throw new Error('Not found');
    }
    return block    
  }

  async put(block) {
    //console.log("putting: " + block.cid);
    this.storage[block.cid.toString()] = block;
  }
}


// ============================================================================
export class IPFSStorage
{
  constructor(ipfs) {
    this.ipfs = ipfs;
  }

  async get(cid) {
    //console.log("getting: " + cid);
    const res = await this.ipfs.dag.get(cid);

    const value = res.value;

    return Block.encode({value, codec, hasher}); 
  }

  async put(block) {
    //console.log("putting: " + block.cid);
    const res = await this.ipfs.dag.put(block.bytes, {cid: block.cid, storeCodec: "dag-cbor", inputCodec: "dag-cbor"});
    if (res.toString() !== block.cid.toString()) {
      throw new Error("put resulted in wrong cid!");
    }
  }
}


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

    this.createOpts = { get, compare, cache, chunker, codec, hasher };
  }

  get rootCid() {
    return this.root ? this.root.block.cid : null;
  }

  async createNew(info) {
    await this._createTree([{key: "@root", value: JSON.stringify(info)}]);
    return this.rootCid;
  }

  async _createTree(list) {
    for await (const node of BTreeMap.create({ list, ...this.createOpts })) {
      await this.storage.put(await node.block);
      this.root = node;
    }
  }

  async loadExisting(cid) {
    this.root = await BTreeMap.load({cid, ...this.createOpts});
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

    //console.log(start, end);
    const res = await this.root.getRangeEntries(start, end);

    //const all = await this.root.getAllEntries();
    //console.log("all", all);

    //console.log("results", res.result);
    return res.result.map((entry) => {return {url: entry.key, cid: entry.value.toString()}});
  }

  async serializeToCar(filename) {
    const { writer, out } = await CarWriter.create([this.root.block.cid]);
    
    Readable.from(out).pipe(fs.createWriteStream(filename));

    const cids = (await this.root.getAllEntries()).cids._cids;

    for (const cid of cids) {
      const block = await this.storage.get(cid);
      await writer.put(block);
    }

    await writer.close();
  }

  async serializeToIpfs(ipfs) {
    const { writer, out } = await CarWriter.create([this.root.block.cid]);
    
    const cids = (await this.root.getAllEntries()).cids._cids;

    const p = new Promise(async resolve => {
      for await (const buff of ipfs.dag.import(out)) {
        console.log(buff);
      }
      console.log("done");
      resolve();
    });

    const promises = [];

    for (const cid of cids) {
      const block = await this.storage.get(cid);
      promises.push(writer.put(block));
    }

    await Promise.all(promises);
    await writer.close();

    await p;
  }
}

export async function verifyUrl(ipfs, cid) {
  //TODO: verify that the specified cid actually contains the archived URL in the WACZ

  try {
    const tempfile = tempy.file();

    Readable.from(ipfs.cat(ipfsPath)).pipe(fs.createWriteStream(tempfile));
  } catch (e) {
    console.log(e);
  }
}



