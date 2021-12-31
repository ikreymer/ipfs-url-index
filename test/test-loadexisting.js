import fs from "fs";
import ava from "ava";

import {
  queryUrl,
  initHttpIpfs,
  ROOT_2,
  ROOT_3,
  EXAMPLE_CID,
  IANA_CID_3,
} from "./helpers.js";

const test = ava.serial;

let app;
let ipfs;

test.before("start ipfs http api", async () => {
  const result = await initHttpIpfs();
  ipfs = result.ipfs;
  app = result.app;
});

test("load from two cars", async (t) => {
  //const ipfs = app.urlIndex.storage.ipfs;

  let cid;

  // load car with first three entries

  for await (const result of ipfs.dag.import(
    fs.createReadStream(new URL("fixtures/first-three.car", import.meta.url))
  )) {
    cid = result.root.cid;
    t.is(cid.toString(), ROOT_2);
  }

  // load car with next two entries

  for await (const result of ipfs.dag.import(
    fs.createReadStream(new URL("fixtures/next-two.car", import.meta.url))
  )) {
    cid = result.root.cid;
    t.is(cid.toString(), ROOT_3);
  }

  // load latest root
  await app.urlIndex.loadExisting(cid);

  t.is(app.urlIndex.rootCid.toString(), ROOT_3);
});

test("search url 1", async (t) => {
  const resp = await queryUrl(app, "https://example.com/");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, [
    {
      key: "com,example)/ 2021-12-24T00:52:26.820Z",
      cid: EXAMPLE_CID,
      url: "https://example.com/",
    },
  ]);
});

test("search url 2", async (t) => {
  const resp = await queryUrl(app, "https://www.iana.org/numbers");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, [
    {
      key: "org,iana)/numbers 2021-12-25T07:38:28.274Z",
      url: "https://www.iana.org/numbers",
      cid: IANA_CID_3,
    },
  ]);
});

test("ensure no new local cids", async (t) => {
  t.is(app.urlIndex.storage.cids.size, 0);
});

test.after("cleanup", async () => {
  await ipfs.stop();
});
