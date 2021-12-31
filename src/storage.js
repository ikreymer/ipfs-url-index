import * as Block from "multiformats/block";
import * as codec from "@ipld/dag-cbor";
import { sha256 as hasher } from "multiformats/hashes/sha2";

// ============================================================================
export class BaseStorage {
  constructor() {
    this._cids = new Set();
    this._existing = new Set();
  }

  _add(cid) {
    if (!this._existing.has(cid.toString())) {
      this._cids.add(cid);
      //console.log("added ", cid);
    }
  }

  _addExisting(cid) {
    //console.log("track existing", cid);
    this._existing.add(cid.toString());
  }

  get cids() {
    return this._cids;
  }
}

// ============================================================================
export class MemStorage extends BaseStorage {
  constructor() {
    super();
    this.storage = {};
  }

  async get(cid) {
    const block = this.storage[cid.toString()];
    //console.log("getting: " + cid);

    if (!block) {
      throw new Error("Not found");
    }
    return block;
  }

  async put(block) {
    //console.log("putting: " + block.cid);
    this.storage[block.cid.toString()] = block;
    this._add(block.cid);
  }
}

// ============================================================================
export class IPFSStorage extends BaseStorage {
  constructor(ipfs) {
    super();
    this.ipfs = ipfs;
  }

  async get(cid) {
    console.log("getting: " + cid);
    this._addExisting(cid);

    const res = await this.ipfs.dag.get(cid);

    const value = res.value;

    return Block.encode({ value, codec, hasher });
  }

  async put(block) {
    console.log("putting: " + block.cid);
    const res = await this.ipfs.dag.put(block.bytes, {
      cid: block.cid,
      storeCodec: "dag-cbor",
      inputCodec: "dag-cbor",
    });
    if (res.toString() !== block.cid.toString()) {
      throw new Error("put resulted in wrong cid!");
    }
    this._add(block.cid);
  }
}

// ============================================================================
export class IPFSReadOnlyStorage extends BaseStorage {
  constructor(ipfs) {
    super();
    this.ipfsStore = new IPFSStorage(ipfs);
    this.memStore = new MemStorage();
    this.ipfs = ipfs;
  }

  async get(cid) {
    // first, try local store
    try {
      return await this.memStore.get(cid);
    } catch (e) {
      // try ipfs store
    }

    // then, ipfs store
    const result = await this.ipfsStore.get(cid);
    this.memStore._addExisting(cid);
    return result;
  }

  async put(block) {
    return await this.memStore.put(block);
  }

  get cids() {
    return this.memStore.cids;
  }
}
