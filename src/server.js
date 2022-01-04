import path from "path";
import fs from "fs";
import express from "express";
import tempy from "tempy";
import * as IPFS from "ipfs-core";
import { create as IPFSHttpCreate } from "ipfs-http-client";
import { CID } from "multiformats";

import cors from "cors";

import Queue from "node-persistent-queue";


import { MemStorage, IPFSStorage, IPFSReadOnlyStorage } from "./storage.js";
import { URLIndex } from "./urlindex.js";

import { processCID } from "./serverutils.js";

const corsWriteAccess = {
  origin: ["http://localhost:10001", "https://dweb.archiveweb.page"]
};

const app = express();
let urlIndex = null;

app.use(express.json());

app.options('/add', cors(corsWriteAccess));
app.options('/addq', cors(corsWriteAccess));

app.post("/add", cors(corsWriteAccess), async (req, res) => {
  const { cid } = req.body;
  if (!cid) {
    res.status(400).json({ error: "missing cid" });
  }

  let root;

  try {
    root = await processCID(app.ipfs, cid, urlIndex);
  } catch (e) {
    console.log(e);
    res.status(400).json({ error: "missing cid or url" });
    return;
  }

  root = root.toString();
  res.json({ root });
});

app.post("/addq", cors(corsWriteAccess), async (req, res) => {
  const { cid } = req.body;
  if (!cid) {
    res.status(400).json({ error: "missing cid" });
  }

  app.queue.add({cid});

  res.json({queued: true});
});


app.get("/root", cors(), async (req, res) => {
  const root = urlIndex.rootCid.toString();
  return res.json({ root });
});

app.get("/query", cors(), async (req, res) => {
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
  queue_db = "",
} = {}) {
  let storage = null;
  let ipfs = null;
  let rootFilename = null;

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

  if (repo) {
    rootFilename = path.join(repo, "root.txt");

    if (!readOnly) {
      saveRoot(app, rootFilename);
    }
  }

  app.ipfs = ipfs;
  urlIndex = new URLIndex(storage);

  if (!root && repo) {
    if (fs.existsSync(rootFilename)) {
      console.log(`load root from ${rootFilename}`);
      root = await fs.promises.readFile(rootFilename, {"encoding": "utf-8"});
      root = root.trim();
    }
  }

  if (root) {
    console.log(`Loading root ${root}`);
    await urlIndex.loadExisting(CID.parse(root));
  } else if (createNew) {
    await urlIndex.createNew({ desc: "url index" });
  }

  app.urlIndex = urlIndex;

  if (!queue_db && repo) {
    queue_db = path.join(repo, "queue.db");
  }

  app.queue = new Queue(queue_db);
  app.queue.on("next", async (task) => {
    try {
      const { cid } = task.job;
      console.log(`processing ${cid}, ${app.queue.getLength()} remaining`);
      await processCID(app.ipfs, cid, urlIndex);
    } catch (e) {
      console.log(e);
    } finally {
      app.queue.done();
    }
  });

  await app.queue.open();
  app.queue.start();

  return app;
}

function saveRoot(app, filename) {
  async function doSave() {
    try {
      const root = app.urlIndex.rootCid.toString();
      await fs.promises.writeFile(filename, root, {"encoding": "utf-8"});
      console.log(`Saved ${root} to ${filename}`);
    } finally {
      process.exit(0);
    }
  }

  process.on("SIGINT", doSave);
  process.on("SIGTERM", doSave);
}
