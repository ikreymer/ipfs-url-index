import express from "express";
import tempy from "tempy";
import * as IPFS from "ipfs-core";
import { create as IPFSHttpCreate } from "ipfs-http-client";
import { CID } from "multiformats";

import { MemStorage, IPFSStorage, IPFSReadOnlyStorage } from "./storage.js";
import { URLIndex } from "./urlindex.js";

import { processCID } from "./serverutils.js";

const app = express();
let urlIndex = null;

app.use(express.json());

app.post("/add", async (req, res) => {
  const { cid } = req.body;
  if (!cid) {
    res.status(400).json({ error: "missing cid" });
  }

  let root;

  try {
    root = await processCID(cid, urlIndex);
  } catch (e) {
    console.log(e);
    res.status(400).json({ error: "missing cid or url" });
    return;
  }

  root = root.toString();
  res.json({ root });
});

app.get("/root", async (req, res) => {
  const root = urlIndex.rootCid.toString();
  return res.json({ root });
});

app.get("/query", async (req, res) => {
  const url = req.query.url;
  const matchType = req.query.matchType;
  const output = req.query.output;
  let results = await urlIndex.query({ url, matchType });
  if (!results || !results.length) {
    res.status(404).json([]);
  } else {
    if (output === "jsonl") {
      for (const line of results) {
        res.write(JSON.stringify(line));
      }
      res.end();
    } else if (output === "cdxj") {
      for (const line of results) {
        const key = line.key;
        delete line.key;
        res.write(key + " " + JSON.stringify(line) + "\n");
      }
      res.end();
 
    } else {
      res.json(results);
    }
  }
});

export async function initApp({
  repo = "",
  url = "",
  memOnly = false,
  readOnly = false,
  createNew = true,
  root = "",
} = {}) {
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

  if (root) {
    console.log(`Loading root ${root}`);
    await urlIndex.loadExisting(CID.parse(root));
  } else if (createNew) {
    await urlIndex.createNew({ desc: "url index" });
  }

  app.urlIndex = urlIndex;

  return app;
}
