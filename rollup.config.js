import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
  input: "index.js",
  output: {
    file: "dist/main.js",
    format: "iife",
    name: "urlindex",
  },
  plugins: [nodeResolve({ browser: true })],
};
