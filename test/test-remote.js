import fs from "fs";
import ava from "ava";

import { CID } from "multiformats";

import { queryUrl } from "./helpers.js";
import { initApp } from "../src/server.js";

const test = ava.serial;

let app;

test.before("connect to remote ipfs api", async () => {
  app = await initApp({createNew: false, readOnly: true, url: "https://ipfs.io/api/v0"});

  //await app.urlIndex.loadExisting(CID.parse("bafyreihunzzaivz6qrv7zcjpyasm237stsl4zygq44h5rxxzyl2ih5x7nm"));
  await app.urlIndex.loadExisting(CID.parse("bafyreiaiio33thu63mlixl6drdnadpjqrbxhpn4qwmsr3d7jgxto5zc2eu"));
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


