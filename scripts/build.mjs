import esbuild from "esbuild";
import { promises as fs } from "fs";

await fs.rm("dist", { recursive: true, force: true });

await esbuild.build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: "dist/extension.js",
  external: ["vscode"],
  sourcemap: false,
  legalComments: "none",
  logLevel: "info"
});
