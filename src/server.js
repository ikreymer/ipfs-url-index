import express from "express";
import tempy from "tempy";
import * as IPFS from "ipfs-core";
import { create as IPFSHttpCreate } from "ipfs-http-client";

import { MemStorage, IPFSStorage, IPFSReadOnlyStorage } from "./storage.js";
import { URLIndex } from "./urlindex.js";

const app = express();
let urlIndex = null;

app.use(express.json());

app.post("/add", async (req, res) => {
  const {url, cid} = req.body;
  if (url && cid) {
    let root = await urlIndex.add(url, cid);
    root = root.toString();
    //console.log(`added ${url} -> ${cid}`);
    res.json({root});
  } else {
    res.status(400).json({error: "missing cid or url"});
  }
});

app.get("/query", async (req, res) => {
  const url = req.query.url;
  const matchType = req.query.matchType;
  let results = await urlIndex.query({url, matchType});
  if (!results || !results.length) {
    res.status(404).json([]);
  } else {
    res.json(results);
  }
});


export async function initApp({repo = "", url = "", memOnly=false, readOnly=false, createNew=true} = {}) {
  let storage = null;
  let ipfs = null;

  if (memOnly) {
    console.log("Not using js-ipfs, in-memory store only");
    storage = new MemStorage();
  } else if (url) {
    ipfs = IPFSHttpCreate(url);
    console.log(`Initing remote ipfs via ${url} (read-only)`);
    storage = new IPFSReadOnlyStorage(ipfs);

  } else {
    repo = repo || tempy.directory();
    console.log(`Initing js-ipfs in ${repo} ${readOnly ? "(read-only)" : ""}`);
    ipfs = await IPFS.create({ repo });
    storage = readOnly ? new IPFSReadOnlyStorage(ipfs) : new IPFSStorage(ipfs);
  }

  urlIndex = new URLIndex(storage);

  if (createNew) {
    await urlIndex.createNew({"desc": "url index"}); 
  }

  app.urlIndex = urlIndex;

  return app;
}

