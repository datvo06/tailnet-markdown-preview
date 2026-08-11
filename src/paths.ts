import * as path from "path";

const IGNORED_PARTS = new Set([
  ".git",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".venv",
  ".vscode-test",
  "__pycache__",
  "coverage",
  "dist",
  "node_modules"
]);

export function encodePathSegments(relativePath: string): string {
  return relativePath
    .split("/")
    .filter((part) => part.length > 0)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function normalizeRelativePath(input: string): string {
  const normalized = path.posix.normalize(input.replaceAll("\\", "/")).replace(/^\/+/, "");
  if (normalized === ".") {
    return "";
  }
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Path escapes the workspace root.");
  }
  return normalized;
}

export function resolveInsideRoot(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const normalized = normalizeRelativePath(relativePath);
  const candidate = path.resolve(resolvedRoot, normalized);
  const relative = path.relative(resolvedRoot, candidate);

  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return candidate;
  }

  throw new Error("Path escapes the workspace root.");
}

export function relativeToRoot(root: string, filePath: string): string {
  return path.relative(path.resolve(root), path.resolve(filePath)).split(path.sep).join("/");
}

export function isMarkdownPath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".md" || ext === ".markdown";
}

export function shouldSkipRelativePath(relativePath: string): boolean {
  const parts = normalizeRelativePath(relativePath).split("/");
  return parts.some((part) => IGNORED_PARTS.has(part));
}
