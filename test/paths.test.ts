import * as path from "path";
import { describe, expect, it } from "vitest";

import {
  encodePathSegments,
  isMarkdownPath,
  normalizeRelativePath,
  relativeToRoot,
  resolveInsideRoot,
  shouldSkipRelativePath
} from "../src/paths";

describe("paths", () => {
  it("normalizes relative paths to web style", () => {
    expect(normalizeRelativePath("docs\\README.md")).toBe("docs/README.md");
    expect(normalizeRelativePath("/docs/../README.md")).toBe("README.md");
  });

  it("rejects workspace escapes", () => {
    expect(() => normalizeRelativePath("../secret.md")).toThrow(/escapes/);
    expect(() => resolveInsideRoot("/tmp/work", "../../secret.md")).toThrow(/escapes/);
  });

  it("resolves paths inside the root", () => {
    expect(resolveInsideRoot("/tmp/work", "docs/../README.md")).toBe(path.resolve("/tmp/work/README.md"));
  });

  it("converts file paths to slash relative paths", () => {
    expect(relativeToRoot("/tmp/work", "/tmp/work/docs/README.md")).toBe("docs/README.md");
  });

  it("recognizes markdown extensions", () => {
    expect(isMarkdownPath("README.md")).toBe(true);
    expect(isMarkdownPath("notes.markdown")).toBe(true);
    expect(isMarkdownPath("notes.txt")).toBe(false);
  });

  it("skips local build and dependency paths", () => {
    expect(shouldSkipRelativePath("node_modules/pkg/README.md")).toBe(true);
    expect(shouldSkipRelativePath("docs/README.md")).toBe(false);
  });

  it("encodes each path segment without losing slashes", () => {
    expect(encodePathSegments("docs/a file.md")).toBe("docs/a%20file.md");
  });
});
