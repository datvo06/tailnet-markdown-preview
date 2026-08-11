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
      markdownFiles: ["README.md", "docs/guide.md"]
    });

    expect(page).toContain('<base href="/raw/docs/">');
    expect(page).toContain("docs/guide.md");
  });
});
