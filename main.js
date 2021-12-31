import { initApp } from "./src/server.js";

export async function run() {
  const app = await initApp({repo: process.argv[2], root: process.argv[4]});
  const port = process.argv[3] || 3000;
  console.log(port);

  app.listen(port, () => {
    console.log(`Server running on ${port}`);
  });
}

run();
