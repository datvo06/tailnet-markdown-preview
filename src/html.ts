import { encodePathSegments } from "./paths";

export interface PreviewPageInput {
  readonly selectedFile: string;
  readonly renderedMarkdown: string;
  readonly markdownFiles: readonly string[];
}

const highlightStyles = `
.hljs{color:#24292e;background:#f6f8fa}
.hljs-comment,.hljs-quote{color:#6a737d}
.hljs-keyword,.hljs-selector-tag,.hljs-subst{color:#d73a49}
.hljs-number,.hljs-literal,.hljs-variable,.hljs-template-variable,.hljs-tag .hljs-attr{color:#005cc5}
.hljs-string,.hljs-doctag{color:#032f62}
.hljs-title,.hljs-section,.hljs-selector-id{color:#6f42c1}
.hljs-type,.hljs-class .hljs-title{color:#d73a49}
@media (prefers-color-scheme: dark){
.hljs{color:#e6edf3;background:#161b22}
.hljs-comment,.hljs-quote{color:#8b949e}
.hljs-keyword,.hljs-selector-tag,.hljs-subst{color:#ff7b72}
.hljs-number,.hljs-literal,.hljs-variable,.hljs-template-variable,.hljs-tag .hljs-attr{color:#79c0ff}
.hljs-string,.hljs-doctag{color:#a5d6ff}
.hljs-title,.hljs-section,.hljs-selector-id{color:#d2a8ff}
.hljs-type,.hljs-class .hljs-title{color:#ffa198}
}`;

const styles = `
:root{
  color-scheme:light dark;
  --bg:#f7f7f4;
  --panel:#ffffff;
  --text:#20211f;
  --muted:#666b6a;
  --line:#d9d8d2;
  --accent:#0f766e;
  --code-bg:#f0f1ed;
  --shadow:0 1px 2px rgb(0 0 0 / 0.06);
}
@media (prefers-color-scheme:dark){
  :root{
    --bg:#171817;
    --panel:#202220;
    --text:#eceee9;
    --muted:#a7aaa4;
    --line:#383b36;
    --accent:#5eead4;
    --code-bg:#151715;
    --shadow:none;
  }
}
*{box-sizing:border-box}
body{
  margin:0;
  background:var(--bg);
  color:var(--text);
  font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  line-height:1.58;
}
a{color:var(--accent);text-decoration-thickness:0.08em;text-underline-offset:0.16em}
.shell{display:grid;grid-template-columns:280px minmax(0,1fr);min-height:100vh}
.sidebar{
  align-self:start;
  background:var(--panel);
  border-right:1px solid var(--line);
  box-shadow:var(--shadow);
  min-height:100vh;
  padding:16px;
  position:sticky;
  top:0;
}
.brand{align-items:baseline;display:flex;gap:12px;justify-content:space-between;margin-bottom:14px}
.brand strong{font-size:15px}
.brand span{color:var(--muted);font-size:12px}
.search{
  background:var(--bg);
  border:1px solid var(--line);
  border-radius:6px;
  color:var(--text);
  font:inherit;
  font-size:14px;
  margin-bottom:12px;
  padding:9px 10px;
  width:100%;
}
.files{display:grid;gap:2px;max-height:calc(100vh - 106px);overflow:auto;padding-right:4px}
.files a{
  border-radius:6px;
  color:var(--text);
  display:block;
  font-size:13px;
  line-height:1.35;
  overflow-wrap:anywhere;
  padding:7px 8px;
  text-decoration:none;
}
.files a:hover{background:color-mix(in srgb,var(--accent) 10%,transparent)}
.files a.active{background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--text)}
.page{min-width:0;padding:28px clamp(18px,5vw,64px) 64px}
.doc{margin:0 auto;max-width:920px}
.path{
  color:var(--muted);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:12px;
  margin-bottom:18px;
  overflow-wrap:anywhere;
}
.markdown-body{
  background:var(--panel);
  border:1px solid var(--line);
  border-radius:8px;
  box-shadow:var(--shadow);
  padding:clamp(18px,4vw,42px);
}
.markdown-body>:first-child{margin-top:0}
.markdown-body>:last-child{margin-bottom:0}
h1,h2,h3,h4,h5,h6{line-height:1.22;margin:1.45em 0 0.55em}
h1{border-bottom:1px solid var(--line);font-size:clamp(2rem,5vw,3rem);padding-bottom:0.28em}
h2{border-bottom:1px solid var(--line);font-size:1.65rem;padding-bottom:0.22em}
h3{font-size:1.25rem}
p,ul,ol,blockquote,table,pre{margin:0.85em 0}
li+li{margin-top:0.2em}
blockquote{border-left:4px solid var(--line);color:var(--muted);padding-left:1em}
code{
  background:var(--code-bg);
  border-radius:4px;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:0.9em;
  padding:0.13em 0.32em;
}
pre{background:var(--code-bg);border-radius:8px;overflow:auto;padding:14px 16px}
pre code{background:transparent;border-radius:0;display:block;padding:0}
table{border-collapse:collapse;display:block;overflow-x:auto;width:100%}
th,td{border:1px solid var(--line);padding:7px 10px;vertical-align:top}
th{background:color-mix(in srgb,var(--accent) 8%,transparent)}
img,video{border-radius:6px;height:auto;max-width:100%}
hr{border:0;border-top:1px solid var(--line);margin:1.5em 0}
.task-list-item{list-style:none}
.task-list-item input{margin:0 0.5em 0 -1.4em}
.missing{background:#fee2e2;border:1px solid #b91c1c;border-radius:8px;color:#7f1d1d;padding:16px}
@media (max-width:760px){
  .shell{display:block}
  .sidebar{border-bottom:1px solid var(--line);border-right:0;min-height:auto;position:static}
  .files{display:flex;gap:6px;max-height:none;overflow-x:auto;padding-bottom:2px}
  .files a{border:1px solid var(--line);flex:0 0 auto;max-width:230px}
  .page{padding-top:18px}
  .markdown-body{border-left:0;border-radius:0;border-right:0;margin:0 -18px}
}
${highlightStyles}`;

const clientScript = `
const currentFile = new URLSearchParams(location.search).get("file") || "";
document.querySelectorAll("[data-file]").forEach((link) => {
  if (link.dataset.file === currentFile) link.classList.add("active");
});
const search = document.querySelector("#file-search");
if (search) {
  search.addEventListener("input", () => {
    const needle = search.value.trim().toLowerCase();
    document.querySelectorAll("[data-file]").forEach((link) => {
      link.hidden = Boolean(needle) && !link.dataset.file.toLowerCase().includes(needle);
    });
  });
}
document.addEventListener("click", (event) => {
  const anchor = event.target.closest("a[href]");
  if (!anchor) return;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/raw/") && url.pathname.toLowerCase().endsWith(".md")) {
    event.preventDefault();
    const file = decodeURIComponent(url.pathname.slice("/raw/".length));
    location.href = "/?file=" + encodeURIComponent(file);
  }
});
if (currentFile && window.EventSource) {
  const events = new EventSource("/events?file=" + encodeURIComponent(currentFile));
  events.addEventListener("reload", () => location.reload());
}`;

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildPreviewPage(input: PreviewPageInput): string {
  const selectedDir = input.selectedFile.includes("/")
    ? input.selectedFile.slice(0, input.selectedFile.lastIndexOf("/"))
    : "";
  const baseHref = selectedDir.length > 0 ? `/raw/${encodePathSegments(selectedDir)}/` : "/raw/";
  const links = input.markdownFiles
    .map((file) => {
      const href = `/?file=${encodeURIComponent(file)}`;
      return `<a href="${href}" data-file="${escapeHtml(file)}">${escapeHtml(file)}</a>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${baseHref}">
  <title>${escapeHtml(input.selectedFile)} - Markdown Preview</title>
  <style>${styles}</style>
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><strong>Markdown Preview</strong><span>${input.markdownFiles.length} files</span></div>
      <input id="file-search" class="search" type="search" autocomplete="off" placeholder="Filter files">
      <nav class="files" aria-label="Markdown files">${links}</nav>
    </aside>
    <main class="page">
      <article class="doc">
        <div class="path">${escapeHtml(input.selectedFile)}</div>
        <div class="markdown-body">${input.renderedMarkdown}</div>
      </article>
    </main>
  </div>
  <script>${clientScript}</script>
</body>
</html>`;
}
