import * as esbuild from "esbuild";
import pkg from "esbuild-plugin-fileloc";
const { filelocPlugin } = pkg;

await esbuild.build({
  entryPoints: ["index.js"],
  bundle: true,
  platform: "node",
  target: ["node20"],
  outfile: "entrypoint.js",
  external: ["nock", "mock-aws-s3", "aws-sdk", "robotjs", "sharp", "get-windows"],
  loader: { ".html": "file", ".node": "binary" },
  plugins: [filelocPlugin()],
});
