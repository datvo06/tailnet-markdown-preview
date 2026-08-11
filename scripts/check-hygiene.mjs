import { promises as fs } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const skipDirs = new Set([".git", "node_modules", "dist", "coverage", ".vscode-test"]);
const bannedPathParts = new Set([".DS_Store"]);
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yml"
]);

const bannedPatterns = [
  {
    pattern: /\/Users\/[^/\s]+/,
    label: "personal macOS path"
  },
  {
    pattern: /[\u2013\u2014]/,
    label: "en dash or em dash"
  }
];

async function main() {
  const failures = [];
  for (const file of await iterFiles(root)) {
    const relative = path.relative(root, file);
    if (relative.split(path.sep).some((part) => bannedPathParts.has(part))) {
      failures.push(`${relative}: generated or local-only file must not be committed`);
      continue;
    }

    if (!textExtensions.has(path.extname(file))) {
      continue;
    }

    const text = await fs.readFile(file, "utf8");
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      for (const { pattern, label } of bannedPatterns) {
        if (pattern.test(line)) {
          failures.push(`${relative}:${index + 1}: ${label}`);
        }
      }
    }
  }

  if (failures.length > 0) {
    console.error("Hygiene check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Hygiene check passed.");
}

async function iterFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (skipDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await iterFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

await main();
