import request from "supertest";

import * as IPFS from "ipfs-core";
import { HttpApi } from "ipfs-http-server";
import tempy from "tempy";

import { initApp } from "../src/server.js";

// contains https://example.com/
export const EXAMPLE_CID =
  "bafybeiaxprxxauua75jigaf4psndrn33bwf27sbid54gxjjuvpm3utoeqy";

// contains https://www.iana.org/domains/reserved
export const IANA_CID_1 =
  "bafybeic4ghvtc2lx3ixoeivv6h7rpxn5cl4ygzgafilnhq7jfygyvabski";

// contains https://www.iana.org/about
export const IANA_CID_2 =
  "bafybeigd4td4mwvsbkqmogkmkm4fh2djhdyvu75db5mmhlum4j66jina5y";

// contains https://www.iana.org/numbers
export const IANA_CID_3 =
  "bafybeihexm67tnjw6ahuhx56ulumtcuonkc2m6erw2ynhny7c7iagshfjm";

export const ROOT_0 =
  "bafyreiezsybpzolqu5hjbrbc4hszzch5himre3lmh433lc62aeegejx574";

export const ROOT_1 =
  "bafyreieazvurcuvbcpwonqkwvghtnrnufy2hllou36sgbg76fsekc3xoga";

export const ROOT_2 =
  "bafyreidha3vbxlele5kdghkenv5qq6yt2jfpsksgpablux3bvdwqe7u7ai";

export const ROOT_3 =
  "bafyreicu35rokftdthl7uujpx6ndjyoxkvnu3gecrp3wfc5ebemrvgysni";

export function addNew(app, cid) {
  return request(app).post("/add").send({ cid });
}

export function queryUrl(app, url, matchType = "exact") {
  return request(app).get("/query").query({ url, matchType });
}

export function getRoot(app) {
  return request(app).get("/root");
}

export async function initHttpIpfs() {
  const repo = tempy.directory();

  const ipfs = await IPFS.create({ repo });

  const httpApi = new HttpApi(ipfs);

  await httpApi.start();

  console.log("IPFS HTTP API: " + httpApi.apiAddr.toString());

  const app = await initApp({
    createNew: false,
    readOnly: true,
    url: httpApi.apiAddr.toString(),
  });

  return { ipfs, app };
}
