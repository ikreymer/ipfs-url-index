import ava from "ava";
import request from "supertest";
import { initApp } from "../server.js";

const test = ava.serial;

const app = await initApp();

function addNew(url, cid) {
  return request(app)
  .post("/add")
  .send({url, cid});
}

function queryUrl(url, matchType="exact") {
  return request(app)
  .get("/query")
  .query({url, matchType});
}

test("add new url", async t => {
  const resp = await addNew("https://example.com/", "bafybeiaxprxxauua75jigaf4psndrn33bwf27sbid54gxjjuvpm3utoeqy");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, {root: "bafyreicec4ta3hmtggfnstextbhqquznh32bqrmkgp3aycdbku5o4tcbym"});
});


test("add new url 2", async t => {
  const resp = await addNew("https://www.iana.org/domains/reserved", "bafybeic4ghvtc2lx3ixoeivv6h7rpxn5cl4ygzgafilnhq7jfygyvabski");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, {root: "bafyreiecggjhsa74e2hqhhluxn5v6gxn7wzfn44defthebvqcn45shjwi4"});
});

test("invalid request", async t => {
  const resp = await request(app)
  .post("/add")
  .send({"url2": "https://www.iana.org/domains/reserved", "cid": "bafybeic4ghvtc2lx3ixoeivv6h7rpxn5cl4ygzgafilnhq7jfygyvabski"});

  t.is(resp.status, 400);
  t.deepEqual(resp.body, {error: "missing cid or url"});
});

test("add new url 3", async t => {
  const resp = await addNew("https://www.iana.org/about", "bafybeigd4td4mwvsbkqmogkmkm4fh2djhdyvu75db5mmhlum4j66jina5y");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, {root: "bafyreihunzzaivz6qrv7zcjpyasm237stsl4zygq44h5rxxzyl2ih5x7nm"});
});


test("search url 1", async t => {
  const resp = await queryUrl("https://example.com/");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, [{"url": "https://example.com/", "cid": "bafybeiaxprxxauua75jigaf4psndrn33bwf27sbid54gxjjuvpm3utoeqy"}]);
  
});


test("search url prefix", async t => {
  const resp = await queryUrl("https://www.iana.org/", "prefix");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, [
    {"url": "https://www.iana.org/about", "cid": "bafybeigd4td4mwvsbkqmogkmkm4fh2djhdyvu75db5mmhlum4j66jina5y"},
    {"url": "https://www.iana.org/domains/reserved", "cid": "bafybeic4ghvtc2lx3ixoeivv6h7rpxn5cl4ygzgafilnhq7jfygyvabski"}
  ]); 
});


test("search url not found", async t => {
  const resp = await queryUrl("https://www.iana.org/");

  t.is(resp.status, 404);
  t.deepEqual(resp.body, []);
  
});

test("search url 2", async t => {
  const resp = await queryUrl("https://www.iana.org/domains/reserved");

  t.is(resp.status, 200);
  t.deepEqual(resp.body, [
    {"url": "https://www.iana.org/domains/reserved", "cid": "bafybeic4ghvtc2lx3ixoeivv6h7rpxn5cl4ygzgafilnhq7jfygyvabski"}
  ]);
  
});





