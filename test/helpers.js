import request from "supertest";

import * as IPFS from "ipfs-core";
import { HttpApi } from "ipfs-http-server";
import tempy from "tempy";

import { initApp } from "../src/server.js";


export function addNew(app, url, cid) {
  return request(app)
    .post("/add")
    .send({url, cid});
}

export function queryUrl(app, url, matchType="exact") {
  return request(app)
    .get("/query")
    .query({url, matchType});
}

export async function initHttpIpfs() {
  const repo = tempy.directory();

  const ipfs = await IPFS.create({ repo });

  const httpApi = new HttpApi(ipfs);
  
  await httpApi.start();

  console.log("IPFS HTTP API: " + httpApi.apiAddr.toString());

  const app = await initApp({createNew: false, readOnly: true, url: httpApi.apiAddr.toString()});

  return {ipfs, app};
}

