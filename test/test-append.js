import fs from "fs";
import ava from "ava";
import request from "supertest";
import tempy from "tempy";

import { CID } from "multiformats";

import { initApp } from "../src/server.js";

import { addNew, queryUrl } from "./helpers.js";

const test = ava.serial;

let app = null;

test.before("init app", async t => {
  app = await initApp({readOnly: true, createNew: false});
});


test("load from car", async t => {
  const ipfs = app.urlIndex.storage.ipfs;

  let cid;

  for await (const result of ipfs.dag.import(fs.createReadStream(new URL("fixtures/first-three.car", import.meta.url)))) {
    cid = result.root.cid;
    t.is(cid.toString(), "bafyreihunzzaivz6qrv7zcjpyasm237stsl4zygq44h5rxxzyl2ih5x7nm");
  }

  await app.urlIndex.loadExisting(cid);

  t.is(app.urlIndex.rootCid.toString(), "bafyreihunzzaivz6qrv7zcjpyasm237stsl4zygq44h5rxxzyl2ih5x7nm");
});


test("search url 1", async t => {
  const resp = await queryUrl(app, "https://example.com/");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, [{"url": "https://example.com/", "cid": "bafybeiaxprxxauua75jigaf4psndrn33bwf27sbid54gxjjuvpm3utoeqy"}]);
  
});

test("add new url", async t => {
  const resp = await addNew(app, "https://www.iana.org/numbers", "bafybeihexm67tnjw6ahuhx56ulumtcuonkc2m6erw2ynhny7c7iagshfjm");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, {root: "bafyreiaiio33thu63mlixl6drdnadpjqrbxhpn4qwmsr3d7jgxto5zc2eu"});
});


test("search url prefix", async t => {
  const resp = await queryUrl(app, "https://www.iana.org/", "prefix");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, [
    {"url": "https://www.iana.org/about", "cid": "bafybeigd4td4mwvsbkqmogkmkm4fh2djhdyvu75db5mmhlum4j66jina5y"},
    {"url": "https://www.iana.org/domains/reserved", "cid": "bafybeic4ghvtc2lx3ixoeivv6h7rpxn5cl4ygzgafilnhq7jfygyvabski"},
    {"url": "https://www.iana.org/numbers", "cid": "bafybeihexm67tnjw6ahuhx56ulumtcuonkc2m6erw2ynhny7c7iagshfjm"}
  ]); 
});

test("check only new cids added", async t => {
  const cids = app.urlIndex.storage.cids;
  const cidStrs = [];

  for (const cid of cids) {
    cidStrs.push(cid.toString());
  }
  cidStrs.sort();
  
  t.is(cidStrs.length, 2);
  t.deepEqual(cidStrs, [
    'bafyreiaf5q334s4ocopshi2344zjiigguo6m5euehzgzx5kxnvdifnaxfy',
    'bafyreiaiio33thu63mlixl6drdnadpjqrbxhpn4qwmsr3d7jgxto5zc2eu'
  ]);

});


test("serialize to car", async t => {
  const tempfile = tempy.file() + ".car";
  //const tempfile = "./next-two.car";

  await app.urlIndex.serializeToCar(tempfile);

  //t.true(fs.existsSync(tempfile));

  const buff = await fs.promises.readFile(tempfile);
  t.true(buff.length > 0);
  
  const expected = await fs.promises.readFile(new URL("fixtures/next-two.car", import.meta.url));
  t.true(buff.equals(expected));

  await fs.promises.unlink(tempfile);
});





