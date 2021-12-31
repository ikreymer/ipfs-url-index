import fs from "fs";
import ava from "ava";
import request from "supertest";
import tempy from "tempy";

import { initApp } from "../src/server.js";

import { serializeToCar } from "../src/serverutils.js";

import {
  addNew,
  queryUrl,
  EXAMPLE_CID,
  IANA_CID_1,
  IANA_CID_2,
  ROOT_0,
  ROOT_1,
  ROOT_2,
} from "./helpers.js";

const test = ava.serial;

let app = null;

test.before("init app", async () => {
  app = await initApp();
});

test("add new url", async (t) => {
  const resp = await addNew(app, EXAMPLE_CID);

  t.is(resp.status, 200);
  t.deepEqual(resp.body, { root: ROOT_0 });
});

test("add new url 2", async (t) => {
  const resp = await addNew(app, IANA_CID_1);

  t.is(resp.status, 200);
  t.deepEqual(resp.body, { root: ROOT_1 });
});

test("invalid request", async (t) => {
  const resp = await request(app)
    .post("/add")
    .send({ cid: "QmSnuWmxptJZdLJpKRarxBMS2Ju2oANVrgbr2xWbie9b2D" });

  t.is(resp.status, 400);
  t.deepEqual(resp.body, { error: "missing cid or url" });
});

test("add new url 3", async (t) => {
  const resp = await addNew(app, IANA_CID_2);

  t.is(resp.status, 200);
  t.deepEqual(resp.body, { root: ROOT_2 });
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
  ]);
});

test("search url not found", async (t) => {
  const resp = await queryUrl(app, "https://www.iana.org/");

  t.is(resp.status, 404);
  t.deepEqual(resp.body, []);
});

test("search url 2", async (t) => {
  const resp = await queryUrl(app, "https://www.iana.org/domains/reserved");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, [
    {
      key: "org,iana)/domains/reserved 2021-12-24T01:37:07.748Z",
      url: "https://www.iana.org/domains/reserved",
      cid: IANA_CID_1,
    },
  ]);
});

test("serialize to car", async (t) => {
  const tempfile = tempy.file() + ".car";
  //const tempfile = "first-three.car";

  await serializeToCar(tempfile, app.urlIndex);

  const buff = await fs.promises.readFile(tempfile);
  const expected = await fs.promises.readFile(
    new URL("fixtures/first-three.car", import.meta.url)
  );
  t.true(buff.equals(expected));

  await fs.promises.unlink(tempfile);
});

test.after("cleanup", async () => {
  await app.urlIndex.storage.ipfs.stop();
});
