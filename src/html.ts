import { encodePathSegments } from "./paths";
import type { EditRequestRecord } from "./types";

export interface PreviewPageInput {
  readonly root: string;
  readonly workspaceName: string;
  readonly selectedFile: string;
  readonly currentDir: string;
  readonly publicBasePath: string;
  readonly renderedMarkdown: string;
  readonly markdownFiles: readonly string[];
  readonly openedFiles: readonly string[];
  readonly editToken: string | undefined;
  readonly editRequests: readonly EditRequestRecord[];
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
.workspace-meta{
  background:var(--bg);
  border:1px solid var(--line);
  border-radius:8px;
  margin-bottom:12px;
  padding:10px;
}
.workspace-name{
  font-size:14px;
  font-weight:700;
  line-height:1.25;
  margin-bottom:6px;
  overflow-wrap:anywhere;
}
.root-path,.current-dir{
  color:var(--muted);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:11px;
  line-height:1.35;
  overflow-wrap:anywhere;
}
.current-dir{margin-top:6px}
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
.section-title{
  color:var(--muted);
  font-size:11px;
  font-weight:700;
  letter-spacing:0.08em;
  margin:14px 0 7px;
  text-transform:uppercase;
}
.open-files,.files,.directories{display:grid;gap:2px;padding-right:4px}
.files{max-height:calc(100vh - 180px);overflow:auto}
.directories{max-height:132px;overflow:auto}
.files a,.directories a{
  border-radius:6px;
  color:var(--text);
  display:block;
  font-size:13px;
  line-height:1.35;
  overflow-wrap:anywhere;
  padding:7px 8px;
  text-decoration:none;
}
.files a:hover,.directories a:hover{background:color-mix(in srgb,var(--accent) 10%,transparent)}
.files a.active,.directories a.active{background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--text)}
.open-file{
  align-items:center;
  border-radius:6px;
  display:grid;
  gap:6px;
  grid-template-columns:minmax(0,1fr) 28px;
}
.open-file a{
  border-radius:6px;
  color:var(--text);
  font-size:13px;
  line-height:1.35;
  overflow:hidden;
  padding:7px 8px;
  text-decoration:none;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.open-file a:hover{background:color-mix(in srgb,var(--accent) 10%,transparent)}
.open-file a.active{background:color-mix(in srgb,var(--accent) 18%,transparent)}
.close-file{
  align-items:center;
  background:transparent;
  border:1px solid transparent;
  border-radius:6px;
  color:var(--muted);
  cursor:pointer;
  display:flex;
  font:inherit;
  height:28px;
  justify-content:center;
  line-height:1;
  padding:0;
  width:28px;
}
.close-file:hover{border-color:var(--line);color:var(--text)}
.page{min-width:0;padding:28px clamp(18px,5vw,64px) 64px}
.doc{margin:0 auto;max-width:920px}
.location{
  border-bottom:1px solid var(--line);
  margin-bottom:18px;
  padding-bottom:12px;
}
.location-title{
  font-size:13px;
  font-weight:700;
  margin-bottom:5px;
  overflow-wrap:anywhere;
}
.breadcrumbs{
  align-items:center;
  display:flex;
  flex-wrap:wrap;
  font-size:12px;
  gap:5px;
  margin-bottom:8px;
}
.breadcrumbs a,.breadcrumbs span{overflow-wrap:anywhere}
.breadcrumb-separator{color:var(--muted)}
.path,.root-display{
  color:var(--muted);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:12px;
  overflow-wrap:anywhere;
}
.root-display{font-size:11px;margin-top:5px}
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
.selection-tools{
  align-items:center;
  background:var(--panel);
  border:1px solid var(--line);
  border-radius:6px;
  box-shadow:var(--shadow);
  display:none;
  gap:6px;
  padding:6px;
  position:fixed;
  z-index:20;
}
.selection-tools.visible{display:flex}
.selection-summary{
  color:var(--muted);
  display:none;
  flex:1;
  font-size:12px;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.selection-tools button,.comment-panel button{
  background:var(--accent);
  border:0;
  border-radius:6px;
  color:var(--panel);
  cursor:pointer;
  font:inherit;
  font-size:13px;
  padding:7px 10px;
}
.comment-panel{
  background:var(--panel);
  border:1px solid var(--line);
  border-radius:8px;
  bottom:18px;
  box-shadow:var(--shadow);
  display:none;
  max-width:min(420px,calc(100vw - 36px));
  padding:14px;
  position:fixed;
  right:18px;
  width:420px;
  z-index:30;
}
.comment-panel.visible{display:block}
.comment-panel label,.edit-requests-title{
  color:var(--muted);
  display:block;
  font-size:12px;
  font-weight:700;
  margin-bottom:6px;
}
.selected-preview{
  background:var(--code-bg);
  border-radius:6px;
  color:var(--muted);
  font-size:12px;
  max-height:90px;
  overflow:auto;
  padding:8px;
}
.comment-panel textarea{
  background:var(--bg);
  border:1px solid var(--line);
  border-radius:6px;
  color:var(--text);
  display:block;
  font:inherit;
  height:94px;
  margin:10px 0;
  padding:8px;
  resize:vertical;
  width:100%;
}
.comment-actions{display:flex;gap:8px;justify-content:flex-end}
.comment-actions .secondary{background:transparent;border:1px solid var(--line);color:var(--text)}
.edit-requests{display:grid;gap:6px;margin-top:12px}
.edit-request{
  border:1px solid var(--line);
  border-radius:6px;
  color:var(--muted);
  font-size:12px;
  padding:7px 8px;
}
.edit-request strong{color:var(--text);display:block;font-size:12px;font-weight:700}
@media (max-width:760px){
  .shell{display:block}
  .sidebar{border-bottom:1px solid var(--line);border-right:0;min-height:auto;position:static}
  .open-files,.files,.directories{display:flex;gap:6px;max-height:none;overflow-x:auto;padding-bottom:2px}
  .files a,.directories a{border:1px solid var(--line);flex:0 0 auto;max-width:230px}
  .open-file{border:1px solid var(--line);flex:0 0 auto;grid-template-columns:minmax(0,180px) 28px}
  .page{padding-top:18px}
  .markdown-body{border-left:0;border-radius:0;border-right:0;margin:0 -18px}
  .selection-tools{
    bottom:12px;
    left:12px !important;
    right:12px;
    top:auto !important;
  }
  .selection-summary{display:block}
  .selection-tools button{flex:0 0 auto}
  .comment-panel{
    bottom:12px;
    left:12px;
    max-width:none;
    right:12px;
    width:auto;
  }
}
${highlightStyles}`;

const clientScript = `
const params = new URLSearchParams(location.search);
const basePath = document.body.dataset.basePath || "";
const currentFile = params.get("file") || document.body.dataset.currentFile || "";
const editToken = params.get("token") || window.localStorage.getItem("tailnetMarkdownPreview.editToken") || "";
if (editToken) window.localStorage.setItem("tailnetMarkdownPreview.editToken", editToken);
const canEdit = document.body.dataset.canEdit === "true" && Boolean(editToken);
const withBasePath = (url) => {
  if (!basePath || !url.startsWith("/")) return url;
  return url === "/" ? basePath + "/" : basePath + url;
};
const stripBasePath = (pathname) => {
  if (!basePath) return pathname;
  if (pathname === basePath) return "/";
  if (pathname.startsWith(basePath + "/")) return pathname.slice(basePath.length);
  return pathname;
};
const withToken = (url) => {
  const next = new URL(withBasePath(url), location.href);
  if (editToken) next.searchParams.set("token", editToken);
  return next.pathname + next.search + next.hash;
};
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
  const closeButton = event.target.closest("[data-close-file]");
  if (closeButton) {
    event.preventDefault();
    const file = closeButton.dataset.closeFile;
    fetch(withToken("/api/open-files?file=" + encodeURIComponent(file)), { method: "DELETE" })
      .then((response) => response.json())
      .then((result) => {
        if (file === currentFile) {
          if (result.nextFile) {
            location.href = withToken("/?file=" + encodeURIComponent(result.nextFile));
          } else {
            location.href = withToken("/");
          }
          return;
        }
        location.reload();
      })
      .catch(() => location.reload());
    return;
  }
  const anchor = event.target.closest("a[href]");
  if (!anchor) return;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin) return;
  const routePath = stripBasePath(url.pathname);
  if (routePath.startsWith("/raw/") && routePath.toLowerCase().endsWith(".md")) {
    event.preventDefault();
    const file = decodeURIComponent(routePath.slice("/raw/".length));
    location.href = withToken("/?file=" + encodeURIComponent(file));
  }
});
if (currentFile && window.EventSource) {
  const events = new EventSource(withBasePath("/events?file=" + encodeURIComponent(currentFile)));
  events.addEventListener("reload", () => location.reload());
}

let selectedText = "";
const markdownBody = document.querySelector(".markdown-body");
const selectionTools = document.querySelector("#selection-tools");
const selectionSummary = document.querySelector("#selection-summary");
const commentPanel = document.querySelector("#comment-panel");
const selectedPreview = document.querySelector("#selected-preview");
const commentText = document.querySelector("#comment-text");
const editRequestList = document.querySelector("#edit-requests");

if (canEdit && markdownBody && selectionTools && commentPanel) {
  const scheduleSelectionCheck = (delay = 0) => {
    window.setTimeout(updateSelectionTools, delay);
  };

  const updateSelectionTools = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      if (!commentPanel.classList.contains("visible")) selectionTools.classList.remove("visible");
      return;
    }
    const text = selection.toString().trim();
    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!text || !(element instanceof Element) || !markdownBody.contains(element)) {
      if (!commentPanel.classList.contains("visible")) selectionTools.classList.remove("visible");
      return;
    }
    selectedText = text.slice(0, 4000);
    if (selectionSummary) selectionSummary.textContent = selectedText;
    const rect = firstUsefulSelectionRect(range);
    selectionTools.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 170)) + "px";
    selectionTools.style.top = Math.max(8, rect.top - 46) + "px";
    selectionTools.classList.add("visible");
  };

  document.addEventListener("selectionchange", () => scheduleSelectionCheck(80));
  document.addEventListener("mouseup", () => scheduleSelectionCheck(20));
  document.addEventListener("keyup", () => scheduleSelectionCheck(20));
  document.addEventListener("pointerup", () => scheduleSelectionCheck(120));
  document.addEventListener("touchend", () => scheduleSelectionCheck(350), { passive: true });
  document.addEventListener("scroll", () => scheduleSelectionCheck(80), { passive: true });

  document.querySelector("#open-comment")?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
  });

  document.querySelector("#open-comment")?.addEventListener("click", () => {
    selectedPreview.textContent = selectedText;
    commentText.value = "";
    commentPanel.classList.add("visible");
    commentText.focus();
  });

  document.querySelector("#cancel-comment")?.addEventListener("click", () => {
    commentPanel.classList.remove("visible");
  });

  document.querySelector("#submit-comment")?.addEventListener("click", () => {
    const comment = commentText.value.trim();
    if (!comment || !selectedText) return;
    fetch(withToken("/api/edit-requests"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: editToken, file: currentFile, selectedText, comment })
    })
      .then((response) => response.json())
      .then(() => {
        commentPanel.classList.remove("visible");
        selectionTools.classList.remove("visible");
        return refreshEditRequests();
      })
      .catch(() => refreshEditRequests());
  });

  setInterval(() => {
    void refreshEditRequests();
  }, 2500);
}

function firstUsefulSelectionRect(range) {
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
  if (rects.length > 0) return rects[0];
  const rect = range.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) return rect;
  return { left: 12, top: window.innerHeight - 70 };
}

function refreshEditRequests() {
  if (!editRequestList || !editToken) return Promise.resolve();
  return fetch(withToken("/api/edit-requests"))
    .then((response) => response.json())
    .then((result) => {
      const requests = Array.isArray(result.requests) ? result.requests : [];
      editRequestList.innerHTML = requests.map(renderEditRequest).join("");
    });
}

function renderEditRequest(request) {
  const status = String(request.status || "queued");
  const provider = String(request.provider || "queue");
  const file = String(request.file || "");
  const message = request.error || request.summary || request.comment || "";
  return '<div class="edit-request"><strong>' + escapeText(status + " - " + provider) + '</strong>' +
    '<div>' + escapeText(file) + '</div><div>' + escapeText(String(message).slice(0, 180)) + '</div></div>';
}

function escapeText(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
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
  const basePath = normalizeBasePath(input.publicBasePath);
  const tokenQuery = input.editToken === undefined ? "" : `&token=${encodeURIComponent(input.editToken)}`;
  const selectedDir = input.selectedFile.includes("/")
    ? input.selectedFile.slice(0, input.selectedFile.lastIndexOf("/"))
    : "";
  const currentDir = input.currentDir || selectedDir;
  const baseHref = joinBasePath(
    basePath,
    selectedDir.length > 0 ? `/raw/${encodePathSegments(selectedDir)}/` : "/raw/"
  );
  const firstFilesByDirectory = mapFirstFilesByDirectory(input.markdownFiles, input.selectedFile);
  const directoryLinks = [...firstFilesByDirectory.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([directory, file]) => {
      const label = directory.length === 0 ? "./" : `${directory}/`;
      const activeClass = directory === currentDir ? ' class="active"' : "";
      return `<a href="${escapeHtml(pageHref(basePath, file, tokenQuery))}" data-directory="${escapeHtml(directory)}"${activeClass}>${escapeHtml(label)}</a>`;
    })
    .join("");
  const breadcrumbs = buildBreadcrumbs(input.selectedFile, firstFilesByDirectory, basePath, tokenQuery);
  const openedLinks = input.openedFiles
    .map((file) => {
      const href = pageHref(basePath, file, tokenQuery);
      return `<div class="open-file"><a href="${escapeHtml(href)}" data-file="${escapeHtml(file)}">${escapeHtml(file)}</a><button class="close-file" type="button" data-close-file="${escapeHtml(file)}" aria-label="Close ${escapeHtml(file)}">x</button></div>`;
    })
    .join("");
  const links = input.markdownFiles
    .map((file) => {
      const href = pageHref(basePath, file, tokenQuery);
      return `<a href="${escapeHtml(href)}" data-file="${escapeHtml(file)}">${escapeHtml(file)}</a>`;
    })
    .join("");
  const editRequests = input.editRequests
    .map((request) => {
      const message = request.error ?? request.summary ?? request.comment;
      return `<div class="edit-request"><strong>${escapeHtml(`${request.status} - ${request.provider}`)}</strong><div>${escapeHtml(request.file)}</div><div>${escapeHtml(message.slice(0, 180))}</div></div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${escapeHtml(baseHref)}">
  <title>${escapeHtml(input.selectedFile)} - Markdown Preview</title>
  <style>${styles}</style>
</head>
<body data-can-edit="${input.editToken === undefined ? "false" : "true"}" data-base-path="${escapeHtml(basePath)}" data-current-file="${escapeHtml(input.selectedFile)}">
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><strong>Markdown Preview</strong><span>${input.openedFiles.length} open</span></div>
      <div class="workspace-meta">
        <div class="workspace-name">${escapeHtml(input.workspaceName)}</div>
        <div class="root-path">${escapeHtml(input.root)}</div>
        <div class="current-dir">${escapeHtml(currentDir.length === 0 ? "." : currentDir)}</div>
      </div>
      <div class="section-title">Open previews</div>
      <nav class="open-files" aria-label="Open previews">${openedLinks}</nav>
      <div class="section-title">Folders</div>
      <nav class="directories" aria-label="Workspace folders">${directoryLinks}</nav>
      <div class="section-title">Workspace files</div>
      <input id="file-search" class="search" type="search" autocomplete="off" placeholder="Filter files">
      <nav class="files" aria-label="Markdown files">${links}</nav>
      <div class="section-title">Edit requests</div>
      <div id="edit-requests" class="edit-requests">${editRequests}</div>
    </aside>
    <main class="page">
      <article class="doc">
        <div class="location">
          <div class="location-title">${escapeHtml(input.workspaceName)}</div>
          <nav class="breadcrumbs" aria-label="Current file path">${breadcrumbs}</nav>
          <div class="path">${escapeHtml(input.selectedFile)}</div>
          <div class="root-display">${escapeHtml(input.root)}</div>
        </div>
        <div class="markdown-body">${input.renderedMarkdown}</div>
      </article>
    </main>
  </div>
  <div id="selection-tools" class="selection-tools"><span id="selection-summary" class="selection-summary"></span><button id="open-comment" type="button">Comment</button></div>
  <section id="comment-panel" class="comment-panel" aria-label="Markdown edit request">
    <label>Selected text</label>
    <div id="selected-preview" class="selected-preview"></div>
    <label for="comment-text">Edit comment</label>
    <textarea id="comment-text" placeholder="Describe the edit to make"></textarea>
    <div class="comment-actions">
      <button id="cancel-comment" class="secondary" type="button">Cancel</button>
      <button id="submit-comment" type="button">Submit</button>
    </div>
  </section>
  <script>${clientScript}</script>
</body>
</html>`;
}

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim();
  if (trimmed.length === 0 || trimmed === "/") {
    return "";
  }
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/u, "");
}

function joinBasePath(basePath: string, routePath: string): string {
  return `${basePath}${routePath}`;
}

function pageHref(basePath: string, file: string, tokenQuery: string): string {
  return `${basePath}/?file=${encodeURIComponent(file)}${tokenQuery}`;
}

function mapFirstFilesByDirectory(files: readonly string[], fallbackFile: string): Map<string, string> {
  const firstFilesByDirectory = new Map<string, string>();
  for (const file of files) {
    const directory = directoryOf(file);
    const parts = directory.length === 0 ? [] : directory.split("/");
    for (let index = 0; index <= parts.length; index += 1) {
      const ancestor = parts.slice(0, index).join("/");
      if (!firstFilesByDirectory.has(ancestor)) {
        firstFilesByDirectory.set(ancestor, file);
      }
    }
  }
  if (!firstFilesByDirectory.has("")) {
    firstFilesByDirectory.set("", fallbackFile);
  }
  return firstFilesByDirectory;
}

function buildBreadcrumbs(
  selectedFile: string,
  firstFilesByDirectory: ReadonlyMap<string, string>,
  basePath: string,
  tokenQuery: string
): string {
  const parts = selectedFile.split("/");
  const links: string[] = [];
  const rootFile = firstFilesByDirectory.get("") ?? selectedFile;
  links.push(`<a href="${escapeHtml(pageHref(basePath, rootFile, tokenQuery))}">.</a>`);
  for (let index = 0; index < parts.length - 1; index += 1) {
    const directory = parts.slice(0, index + 1).join("/");
    const file = firstFilesByDirectory.get(directory) ?? selectedFile;
    links.push(`<a href="${escapeHtml(pageHref(basePath, file, tokenQuery))}">${escapeHtml(parts[index] ?? "")}</a>`);
  }
  links.push(`<span>${escapeHtml(parts.at(-1) ?? selectedFile)}</span>`);
  return links.join('<span class="breadcrumb-separator">/</span>');
}

function directoryOf(file: string): string {
  const index = file.lastIndexOf("/");
  return index === -1 ? "" : file.slice(0, index);
}
