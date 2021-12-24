import { initApp } from "./server.js";

export async function run() {
  const app = await initApp(process.argv[2]);
  const port = process.argv[3] || 3000;

  app.listen(port, () => {
    console.log(`Server running on ${port}`);
  });
}

run();


