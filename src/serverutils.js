import fs from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import tempy from "tempy";

import StreamZip from "node-stream-zip";
import { CarWriter } from "@ipld/car";

// ===========================================================================
export async function loadWACZ(ipfs, cid) {
  const tempfile = tempy.file();
  const file = fs.createWriteStream(tempfile);

  const catiter = ipfs.cat(cid + "/webarchive.wacz");

  await pipeline(catiter, file);

  let text;

  try {
    const zip = new StreamZip.async({ file: tempfile });

    const decoder = new TextDecoder();

    const pagedata = await zip.entryData("pages/pages.jsonl");

    text = decoder.decode(pagedata);
  } catch (e) {
    console.warn(`invalid wacz in ${cid}`);
    throw e;
  }

  const results = [];

  for (const line of text.split("\n")) {
    try {
      const { url, ts } = JSON.parse(line);
      if (url && ts) {
        results.push({ url, ts });
      }
    } catch (e) {
      console.log(e);
    }
  }

  await fs.promises.unlink(tempfile);
  return results;
}

// ===========================================================================
export async function processCID(ipfs, cid, urlIndex) {
  const results = await loadWACZ(ipfs, cid);

  let root;

  for (const result of results) {
    result.cid = cid;
    root = await urlIndex.add(result);
  }

  return root;
}

// ===========================================================================
export async function serializeToCar(filename, urlIndex) {
  const { writer, out } = await CarWriter.create([urlIndex.root.block.cid]);

  const writable = fs.createWriteStream(filename);

  const p = new Promise((resolve) => {
    writable.once("finish", () => resolve());
  });

  Readable.from(out).pipe(writable);

  const storage = urlIndex.storage;

  for (const cid of storage.cids) {
    const block = await storage.get(cid);
    await writer.put(block);
  }

  await writer.close();
  await p;
}
