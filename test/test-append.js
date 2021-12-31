import fs from "fs";
import ava from "ava";
import tempy from "tempy";

import { initApp } from "../src/server.js";
import { serializeToCar } from "../src/serverutils.js";

import {
  addNew,
  queryUrl,
  getRoot,
  EXAMPLE_CID,
  IANA_CID_1,
  IANA_CID_2,
  IANA_CID_3,
  ROOT_2,
  ROOT_3,
} from "./helpers.js";

const test = ava.serial;

let app = null;

test.before("init app", async () => {
  app = await initApp({ readOnly: true, createNew: false });
});

test("load from car", async (t) => {
  const ipfs = app.urlIndex.storage.ipfs;

  let cid;

  for await (const result of ipfs.dag.import(
    fs.createReadStream(new URL("fixtures/first-three.car", import.meta.url))
  )) {
    cid = result.root.cid;
    t.is(cid.toString(), ROOT_2);
  }

  await app.urlIndex.loadExisting(cid);

  t.is(app.urlIndex.rootCid.toString(), ROOT_2);
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

test("add new url", async (t) => {
  const resp = await addNew(app, IANA_CID_3);

  t.is(resp.status, 200);
  t.deepEqual(resp.body, { root: ROOT_3 });
});

test("search url prefix", async (t) => {
  const resp = await queryUrl(app, "https://www.iana.org/", "prefix");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, [
    {
      key: "org,iana)/about 2021-12-24T17:58:44.696Z",
      url: "https://www.iana.org/about",
      cid: IANA_CID_2,
    },
    {
      key: "org,iana)/domains/reserved 2021-12-24T01:37:07.748Z",
      url: "https://www.iana.org/domains/reserved",
      cid: IANA_CID_1,
    },
    {
      key: "org,iana)/numbers 2021-12-25T07:38:28.274Z",
      url: "https://www.iana.org/numbers",
      cid: IANA_CID_3,
    },
  ]);
});

test("check only new cids added", async (t) => {
  const cids = app.urlIndex.storage.cids;
  const cidStrs = [];

  for (const cid of cids) {
    cidStrs.push(cid.toString());
  }
  cidStrs.sort();

  t.is(cidStrs.length, 1);
  t.deepEqual(cidStrs, [ROOT_3]);
});

test("test root", async (t) => {
  const resp = await getRoot(app);
  t.deepEqual(resp.body, { root: ROOT_3 });
});

test("serialize to car", async (t) => {
  const tempfile = tempy.file() + ".car";
  //const tempfile = "./next-two.car";

  await serializeToCar(tempfile, app.urlIndex);

  //t.true(fs.existsSync(tempfile));

  const buff = await fs.promises.readFile(tempfile);
  t.true(buff.length > 0);

  const expected = await fs.promises.readFile(
    new URL("fixtures/next-two.car", import.meta.url)
  );
  t.true(buff.equals(expected));

  await fs.promises.unlink(tempfile);
});

test.after("cleanup", async () => {
  await app.urlIndex.storage.ipfs.stop();
});
