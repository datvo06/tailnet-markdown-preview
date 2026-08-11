import { describe, expect, it } from "vitest";

import { buildPreviewPage, escapeHtml } from "../src/html";

describe("html", () => {
  it("escapes text content", () => {
    expect(escapeHtml("<script>\"x\"</script>")).toBe("&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
  });

  it("sets a base href from the selected markdown file directory", () => {
    const page = buildPreviewPage({
      selectedFile: "docs/guide.md",
      renderedMarkdown: "<h1>Guide</h1>",
      markdownFiles: ["README.md", "docs/guide.md"],
      openedFiles: ["docs/guide.md"]
    });

    expect(page).toContain('<base href="/raw/docs/">');
    expect(page).toContain("docs/guide.md");
  });

  it("renders opened files with close controls", () => {
    const page = buildPreviewPage({
      selectedFile: "README.md",
      renderedMarkdown: "<h1>Readme</h1>",
      markdownFiles: ["README.md"],
      openedFiles: ["README.md"]
    });

    expect(page).toContain("Open previews");
    expect(page).toContain('data-close-file="README.md"');
  });
});
