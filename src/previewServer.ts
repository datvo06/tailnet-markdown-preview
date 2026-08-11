import { createReadStream, promises as fs } from "fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import * as path from "path";
import { randomBytes, randomUUID } from "crypto";
import { lookup } from "mime-types";

import { buildPreviewPage, escapeHtml } from "./html";
import { MarkdownRenderer } from "./markdown";
import {
  isMarkdownPath,
  normalizeRelativePath,
  relativeToRoot,
  resolveInsideRoot,
  shouldSkipRelativePath
} from "./paths";
import type {
  EditRequestRecord,
  EditRunner,
  PreviewServerInfo,
  PreviewServerOptions
} from "./types";

interface ActiveServer {
  readonly server: Server;
  readonly state: ServerState;
}

interface ServerState {
  readonly root: string;
  readonly bindHost: string;
  publicHost: string;
  readonly port: number;
  readonly allowHtml: boolean;
  readonly renderer: MarkdownRenderer;
  readonly editToken: string;
  editRunner: EditRunner | undefined;
  readonly editRequests: Map<string, MutableEditRequestRecord>;
  editRunning: boolean;
  selectedFile: string;
  tailscaleServeUrl: string | undefined;
  readonly openedFiles: Set<string>;
}

interface MutableEditRequestRecord {
  id: string;
  root: string;
  file: string;
  selectedText: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
  status: "queued" | "running" | "succeeded" | "failed";
  provider: string;
  summary: string | undefined;
  error: string | undefined;
}

interface EditRequestPayload {
  readonly file?: unknown;
  readonly selectedText?: unknown;
  readonly comment?: unknown;
  readonly token?: unknown;
}

export class PreviewServer {
  private active: ActiveServer | undefined;

  public async start(options: PreviewServerOptions): Promise<PreviewServerInfo> {
    const file = normalizeRelativePath(options.file);
    if (this.active !== undefined && canReuseServer(this.active.state, options)) {
      this.active.state.publicHost = options.publicHost;
      this.active.state.editRunner = options.editRunner;
      this.active.state.tailscaleServeUrl = undefined;
      this.active.state.selectedFile = file;
      this.active.state.openedFiles.add(file);
      return buildInfo(this.active.state);
    }

    await this.stop();

    const renderer = new MarkdownRenderer(options.allowHtml);
    const state: ServerState = {
      root: options.root,
      bindHost: options.bindHost,
      publicHost: options.publicHost,
      port: options.port,
      allowHtml: options.allowHtml,
      renderer,
      editToken: randomBytes(18).toString("hex"),
      editRunner: options.editRunner,
      editRequests: new Map(),
      editRunning: false,
      selectedFile: file,
      tailscaleServeUrl: undefined,
      openedFiles: new Set([file])
    };
    const server = createServer((request, response) => {
      void this.handleRequest(request, response, state);
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options.port, options.bindHost, () => {
        server.off("error", reject);
        resolve();
      });
    });

    this.active = { server, state };
    return buildInfo(state);
  }

  public async stop(): Promise<void> {
    const active = this.active;
    this.active = undefined;
    if (active === undefined) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      active.server.close((error) => {
        if (error !== undefined) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  public getInfo(): PreviewServerInfo | undefined {
    return this.active === undefined ? undefined : buildInfo(this.active.state);
  }

  public setTailscaleServeUrl(url: string): PreviewServerInfo | undefined {
    if (this.active === undefined) {
      return undefined;
    }

    this.active.state.tailscaleServeUrl = url;
    return buildInfo(this.active.state);
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    state: ServerState
  ): Promise<void> {
    try {
      const url = new URL(request.url ?? "/", "http://preview.local");
      if (url.pathname === "/health") {
        sendText(response, 200, "ok\n", "text/plain; charset=utf-8");
        return;
      }

      if (url.pathname === "/api/edit-requests" && request.method === "GET") {
        if (!isAuthorized(url, state)) {
          sendJson(response, 403, { error: "Invalid preview token." });
          return;
        }
        sendJson(response, 200, { requests: serializeEditRequests(state) });
        return;
      }

      if (url.pathname === "/api/edit-requests" && request.method === "POST") {
        const body = await readJsonBody(request);
        if (!isAuthorized(url, state, body)) {
          sendJson(response, 403, { error: "Invalid preview token." });
          return;
        }
        await this.submitEditRequest(response, state, body);
        return;
      }

      if (url.pathname === "/api/open-files" && request.method === "DELETE") {
        if (!isAuthorized(url, state)) {
          sendJson(response, 403, { error: "Invalid preview token." });
          return;
        }
        this.closeOpenFile(response, state, url.searchParams.get("file"));
        return;
      }

      if (url.pathname === "/events") {
        await this.streamEvents(request, response, state.root, url.searchParams.get("file") ?? state.selectedFile);
        return;
      }

      if (url.pathname.startsWith("/raw/")) {
        await this.serveRaw(response, state.root, url.pathname.slice("/raw/".length));
        return;
      }

      if (url.pathname === "/") {
        await this.servePage(
          response,
          state,
          url.searchParams.get("file") ?? firstOpenedFile(state),
          isAuthorized(url, state)
        );
        return;
      }

      sendText(response, 404, "Not found\n", "text/plain; charset=utf-8");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unexpected preview server error.";
      sendText(response, 500, `${message}\n`, "text/plain; charset=utf-8");
    }
  }

  private async servePage(
    response: ServerResponse,
    state: ServerState,
    requestedFile: string,
    canEdit: boolean
  ): Promise<void> {
    const selectedFile = normalizeRelativePath(decodeURIComponent(requestedFile));
    const markdownFiles = await listMarkdownFiles(state.root);
    const filePath = resolveInsideRoot(state.root, selectedFile);

    let renderedMarkdown: string;
    if (!isMarkdownPath(filePath)) {
      renderedMarkdown = missingDocument(`Not a Markdown file: ${selectedFile}`);
    } else {
      try {
        const source = await fs.readFile(filePath, "utf8");
        state.selectedFile = selectedFile;
        state.openedFiles.add(selectedFile);
        renderedMarkdown = state.renderer.render(source);
      } catch (error: unknown) {
        if (hasCode(error, "ENOENT")) {
          renderedMarkdown = missingDocument(`Markdown file not found: ${selectedFile}`);
        } else {
          throw error;
        }
      }
    }

    sendText(
      response,
      200,
      buildPreviewPage({
        selectedFile,
        renderedMarkdown,
        markdownFiles,
        openedFiles: [...state.openedFiles],
        editToken: canEdit ? state.editToken : undefined,
        editRequests: canEdit ? serializeEditRequests(state) : []
      }),
      "text/html; charset=utf-8"
    );
  }

  private async submitEditRequest(
    response: ServerResponse,
    state: ServerState,
    body: EditRequestPayload
  ): Promise<void> {
    if (typeof body.file !== "string" || typeof body.selectedText !== "string" || typeof body.comment !== "string") {
      sendJson(response, 400, { error: "Expected file, selectedText, and comment." });
      return;
    }

    const file = normalizeRelativePath(body.file);
    const filePath = resolveInsideRoot(state.root, file);
    if (!isMarkdownPath(filePath)) {
      sendJson(response, 400, { error: "Edit requests are only supported for Markdown files." });
      return;
    }
    const stats = await fs.stat(filePath).catch((error: unknown) => {
      if (hasCode(error, "ENOENT")) {
        return undefined;
      }
      throw error;
    });
    if (stats === undefined || !stats.isFile()) {
      sendJson(response, 404, { error: "Markdown file not found." });
      return;
    }
    if (body.selectedText.trim().length === 0 || body.comment.trim().length === 0) {
      sendJson(response, 400, { error: "Selection and comment are required." });
      return;
    }

    const now = new Date().toISOString();
    const record: MutableEditRequestRecord = {
      id: randomUUID(),
      root: state.root,
      file,
      selectedText: body.selectedText.trim().slice(0, 4000),
      comment: body.comment.trim().slice(0, 4000),
      createdAt: now,
      updatedAt: now,
      status: "queued",
      provider: state.editRunner === undefined ? "queue" : "pending",
      summary: undefined,
      error: undefined
    };
    state.editRequests.set(record.id, record);
    trimEditRequests(state);
    this.processEditQueue(state);
    sendJson(response, 202, { request: serializeEditRequest(record) });
  }

  private processEditQueue(state: ServerState): void {
    if (state.editRunning || state.editRunner === undefined) {
      return;
    }

    const next = [...state.editRequests.values()].find((record) => record.status === "queued");
    if (next === undefined) {
      return;
    }

    state.editRunning = true;
    next.status = "running";
    next.updatedAt = new Date().toISOString();
    void state
      .editRunner({
        id: next.id,
        root: next.root,
        file: next.file,
        selectedText: next.selectedText,
        comment: next.comment,
        createdAt: next.createdAt
      })
      .then((result) => {
        next.status = "succeeded";
        next.provider = result.provider;
        next.summary = result.summary;
        next.updatedAt = new Date().toISOString();
      })
      .catch((error: unknown) => {
        next.status = "failed";
        next.provider = next.provider === "pending" ? "agent" : next.provider;
        next.error = error instanceof Error ? error.message : "Unknown edit agent error.";
        next.updatedAt = new Date().toISOString();
      })
      .finally(() => {
        state.editRunning = false;
        this.processEditQueue(state);
      });
  }

  private closeOpenFile(response: ServerResponse, state: ServerState, requestedFile: string | null): void {
    if (requestedFile === null) {
      sendJson(response, 400, { error: "Missing file." });
      return;
    }

    const file = normalizeRelativePath(decodeURIComponent(requestedFile));
    state.openedFiles.delete(file);
    if (state.selectedFile === file) {
      state.selectedFile = firstOpenedFile(state);
    }
    sendJson(response, 200, {
      closed: true,
      nextFile: state.selectedFile.length > 0 ? state.selectedFile : undefined
    });
  }

  private async serveRaw(response: ServerResponse, root: string, requestedPath: string): Promise<void> {
    const relativePath = normalizeRelativePath(decodeURIComponent(requestedPath));
    const filePath = resolveInsideRoot(root, relativePath);
    const stats = await fs.stat(filePath).catch((error: unknown) => {
      if (hasCode(error, "ENOENT")) {
        return undefined;
      }
      throw error;
    });

    if (stats === undefined || !stats.isFile()) {
      sendText(response, 404, "Not found\n", "text/plain; charset=utf-8");
      return;
    }

    response.writeHead(200, {
      "Content-Type": lookup(filePath) || "application/octet-stream",
      "Content-Length": stats.size
    });
    createReadStream(filePath).pipe(response);
  }

  private async streamEvents(
    request: IncomingMessage,
    response: ServerResponse,
    root: string,
    requestedFile: string
  ): Promise<void> {
    const relativePath = normalizeRelativePath(decodeURIComponent(requestedFile));
    const filePath = resolveInsideRoot(root, relativePath);

    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });

    let lastMtime = await readMtime(filePath);
    const interval = setInterval(() => {
      void (async () => {
        const currentMtime = await readMtime(filePath);
        if (currentMtime !== lastMtime) {
          lastMtime = currentMtime;
          response.write("event: reload\ndata: {}\n\n");
        } else {
          response.write(": keepalive\n\n");
        }
      })().catch(() => {
        clearInterval(interval);
        response.end();
      });
    }, 1000);

    request.on("close", () => {
      clearInterval(interval);
    });
  }
}

export function buildPreviewUrl(host: string, port: number, file: string, token?: string): string {
  const urlHost = host.includes(":") ? `[${host}]` : host;
  const tokenPart = token === undefined ? "" : `&token=${encodeURIComponent(token)}`;
  return `http://${urlHost}:${port}/?file=${encodeURIComponent(file)}${tokenPart}`;
}

function buildInfo(state: ServerState): PreviewServerInfo {
  return {
    root: state.root,
    file: state.selectedFile,
    bindHost: state.bindHost,
    publicHost: state.publicHost,
    port: state.port,
    url: buildPreviewUrl(state.publicHost, state.port, state.selectedFile, state.editToken),
    tailscaleServeUrl: state.tailscaleServeUrl,
    openedFiles: [...state.openedFiles],
    editToken: state.editToken
  };
}

function canReuseServer(state: ServerState, options: PreviewServerOptions): boolean {
  return (
    state.root === options.root &&
    state.bindHost === options.bindHost &&
    state.port === options.port &&
    state.allowHtml === options.allowHtml
  );
}

function firstOpenedFile(state: ServerState): string {
  return state.openedFiles.values().next().value ?? state.selectedFile;
}

function isAuthorized(url: URL, state: ServerState, body?: EditRequestPayload): boolean {
  const queryToken = url.searchParams.get("token");
  const bodyToken = typeof body?.token === "string" ? body.token : undefined;
  return queryToken === state.editToken || bodyToken === state.editToken;
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(directory, entry.name);
        const relativePath = relativeToRoot(root, fullPath);
        if (shouldSkipRelativePath(relativePath)) {
          return;
        }
        if (entry.isDirectory()) {
          await visit(fullPath);
          return;
        }
        if (entry.isFile() && isMarkdownPath(fullPath)) {
          files.push(relativePath);
        }
      })
    );
  }

  await visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

async function readMtime(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath).catch((error: unknown) => {
    if (hasCode(error, "ENOENT")) {
      return undefined;
    }
    throw error;
  });
  return stats?.mtimeMs ?? 0;
}

function sendText(response: ServerResponse, status: number, body: string, contentType: string): void {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  sendText(response, status, JSON.stringify(body), "application/json; charset=utf-8");
}

function serializeEditRequests(state: ServerState): EditRequestRecord[] {
  return [...state.editRequests.values()].map(serializeEditRequest);
}

function serializeEditRequest(record: MutableEditRequestRecord): EditRequestRecord {
  return {
    id: record.id,
    root: record.root,
    file: record.file,
    selectedText: record.selectedText,
    comment: record.comment,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    status: record.status,
    provider: record.provider,
    summary: record.summary,
    error: record.error
  };
}

function trimEditRequests(state: ServerState): void {
  while (state.editRequests.size > 50) {
    const firstKey = state.editRequests.keys().next().value;
    if (firstKey === undefined) {
      return;
    }
    state.editRequests.delete(firstKey);
  }
}

function readJsonBody(request: IncomingMessage): Promise<EditRequestPayload> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(raw) as EditRequestPayload);
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error("Invalid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function missingDocument(message: string): string {
  return `<div class="missing">${escapeHtml(message)}</div>`;
}

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
