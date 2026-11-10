import { build } from "esbuild";

await build({
  entryPoints: ["src/server/react-handler.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: "api/react.js",
  target: "node22",
});
