//import fs from "fs";
import ava from "ava";

import { CID } from "multiformats";

import { queryUrl, ROOT_3, EXAMPLE_CID, IANA_CID_3 } from "./helpers.js";
import { initApp } from "../src/server.js";

const test = ava.serial;

let app;

test.before("connect to remote ipfs api", async () => {
  app = await initApp({
    createNew: false,
    readOnly: true,
    url: "https://ipfs.io/api/v0",
  });

  await app.urlIndex.loadExisting(CID.parse(ROOT_3));
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
