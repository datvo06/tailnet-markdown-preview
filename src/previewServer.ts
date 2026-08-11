import { createReadStream, promises as fs } from "fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import * as path from "path";
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
import type { PreviewServerInfo, PreviewServerOptions } from "./types";

interface ActiveServer {
  readonly server: Server;
  readonly info: PreviewServerInfo;
}

export class PreviewServer {
  private active: ActiveServer | undefined;

  public async start(options: PreviewServerOptions): Promise<PreviewServerInfo> {
    await this.stop();

    const renderer = new MarkdownRenderer(options.allowHtml);
    const file = normalizeRelativePath(options.file);
    const server = createServer((request, response) => {
      void this.handleRequest(request, response, options.root, file, renderer);
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options.port, options.host, () => {
        server.off("error", reject);
        resolve();
      });
    });

    const url = buildPreviewUrl(options.host, options.port, file);
    const info: PreviewServerInfo = {
      root: options.root,
      file,
      host: options.host,
      port: options.port,
      url,
      tailscaleServeUrl: undefined
    };
    this.active = { server, info };
    return info;
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
    return this.active?.info;
  }

  public setTailscaleServeUrl(url: string): PreviewServerInfo | undefined {
    if (this.active === undefined) {
      return undefined;
    }

    const info: PreviewServerInfo = {
      ...this.active.info,
      tailscaleServeUrl: url
    };
    this.active = {
      server: this.active.server,
      info
    };
    return info;
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    root: string,
    defaultFile: string,
    renderer: MarkdownRenderer
  ): Promise<void> {
    try {
      const url = new URL(request.url ?? "/", "http://preview.local");
      if (url.pathname === "/health") {
        sendText(response, 200, "ok\n", "text/plain; charset=utf-8");
        return;
      }

      if (url.pathname === "/events") {
        await this.streamEvents(request, response, root, url.searchParams.get("file") ?? defaultFile);
        return;
      }

      if (url.pathname.startsWith("/raw/")) {
        await this.serveRaw(response, root, url.pathname.slice("/raw/".length));
        return;
      }

      if (url.pathname === "/") {
        await this.servePage(response, root, url.searchParams.get("file") ?? defaultFile, renderer);
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
    root: string,
    requestedFile: string,
    renderer: MarkdownRenderer
  ): Promise<void> {
    const selectedFile = normalizeRelativePath(decodeURIComponent(requestedFile));
    const markdownFiles = await listMarkdownFiles(root);
    const filePath = resolveInsideRoot(root, selectedFile);

    let renderedMarkdown: string;
    if (!isMarkdownPath(filePath)) {
      renderedMarkdown = missingDocument(`Not a Markdown file: ${selectedFile}`);
    } else {
      try {
        const source = await fs.readFile(filePath, "utf8");
        renderedMarkdown = renderer.render(source);
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
      buildPreviewPage({ selectedFile, renderedMarkdown, markdownFiles }),
      "text/html; charset=utf-8"
    );
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

export function buildPreviewUrl(host: string, port: number, file: string): string {
  const urlHost = host.includes(":") ? `[${host}]` : host;
  return `http://${urlHost}:${port}/?file=${encodeURIComponent(file)}`;
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
