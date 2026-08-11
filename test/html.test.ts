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
      openedFiles: ["docs/guide.md"],
      editToken: "token",
      editRequests: []
    });

    expect(page).toContain('<base href="/raw/docs/">');
    expect(page).toContain("docs/guide.md");
  });

  it("renders opened files with close controls", () => {
    const page = buildPreviewPage({
      selectedFile: "README.md",
      renderedMarkdown: "<h1>Readme</h1>",
      markdownFiles: ["README.md"],
      openedFiles: ["README.md"],
      editToken: "token",
      editRequests: []
    });

    expect(page).toContain("Open previews");
    expect(page).toContain('data-close-file="README.md"');
  });

  it("renders browser edit controls only when an edit token is present", () => {
    const page = buildPreviewPage({
      selectedFile: "README.md",
      renderedMarkdown: "<h1>Readme</h1>",
      markdownFiles: ["README.md"],
      openedFiles: ["README.md"],
      editToken: "token",
      editRequests: [
        {
          id: "request-1",
          root: "/tmp/work",
          file: "README.md",
          selectedText: "Readme",
          comment: "Make this more direct.",
          createdAt: "2026-08-11T00:00:00.000Z",
          updatedAt: "2026-08-11T00:00:00.000Z",
          status: "queued",
          provider: "queue",
          summary: undefined,
          error: undefined
        }
      ]
    });

    expect(page).toContain('data-can-edit="true"');
    expect(page).toContain("Edit requests");
    expect(page).toContain("queued - queue");
  });
});
