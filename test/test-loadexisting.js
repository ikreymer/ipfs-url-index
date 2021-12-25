import fs from "fs";
import ava from "ava";
import request from "supertest";
import tempy from "tempy";
import path from "path";
import { CID } from "multiformats";

import { initApp } from "../src/server.js";

import { addNew, queryUrl, initHttpIpfs } from "./helpers.js";

const test = ava.serial;


let app;
let ipfs;

test.before("start ipfs http api", async t => {
  const result = await initHttpIpfs();
  ipfs = result.ipfs;
  app = result.app;
});


test("load from two cars", async t => {
  //const ipfs = app.urlIndex.storage.ipfs;

  let cid;

  // load car with first three entries

  for await (const result of ipfs.dag.import(fs.createReadStream(new URL("fixtures/firstthree.car", import.meta.url)))) {
    cid = result.root.cid;
    t.is(cid.toString(), "bafyreihunzzaivz6qrv7zcjpyasm237stsl4zygq44h5rxxzyl2ih5x7nm");
  }

  // load car with next two entries

  for await (const result of ipfs.dag.import(fs.createReadStream(new URL("fixtures/next-two.car", import.meta.url)))) {
    cid = result.root.cid;
    t.is(cid.toString(), "bafyreiaiio33thu63mlixl6drdnadpjqrbxhpn4qwmsr3d7jgxto5zc2eu");
  }

  // load latest root
  await app.urlIndex.loadExisting(cid);

  t.is(app.urlIndex.rootCid.toString(), "bafyreiaiio33thu63mlixl6drdnadpjqrbxhpn4qwmsr3d7jgxto5zc2eu");
});

test("search url 1", async t => {
  const resp = await queryUrl(app, "https://example.com/");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, [{"url": "https://example.com/", "cid": "bafybeiaxprxxauua75jigaf4psndrn33bwf27sbid54gxjjuvpm3utoeqy"}]);
  
});

test("search url 2", async t => {
  const resp = await queryUrl(app, "https://www.iana.org/numbers");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, [{"url": "https://www.iana.org/numbers", "cid": "bafybeihexm67tnjw6ahuhx56ulumtcuonkc2m6erw2ynhny7c7iagshfjm"}]);
  
});


test("ensure no new local cids", async t => {
  t.is(app.urlIndex.storage.cids.size, 0);
});


