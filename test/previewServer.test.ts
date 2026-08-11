import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";
import { createServer } from "net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PreviewServer } from "../src/previewServer";
import type { BrowserEditRequest, EditRunResult } from "../src/types";

describe("PreviewServer", () => {
  let root: string;
  let previewServer: PreviewServer;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "tailnet-md-preview-"));
    await writeFile(path.join(root, "a.md"), "# A\n", "utf8");
    await writeFile(path.join(root, "b.md"), "# B\n", "utf8");
    previewServer = new PreviewServer();
  });

  afterEach(async () => {
    await previewServer.stop();
    await rm(root, { recursive: true, force: true });
  });

  it("uses a public URL host that can differ from the bind host", async () => {
    const port = await getFreePort();
    const info = await previewServer.start({
      root,
      file: "a.md",
      bindHost: "127.0.0.1",
      publicHost: "100.64.0.1",
      port,
      allowHtml: false,
      editRunner: undefined
    });

    expect(info.url).toBe(`http://100.64.0.1:${port}/?file=a.md&token=${info.editToken}`);

    const response = await fetch(`http://127.0.0.1:${port}/?file=a.md&token=${info.editToken}`);
    expect(await response.text()).toContain("Open previews");
  });

  it("falls back when the preferred port is already in use", async () => {
    const occupied = await listenOnFreePort();
    try {
      const info = await previewServer.start({
        root,
        file: "a.md",
        bindHost: "127.0.0.1",
        publicHost: "100.64.0.1",
        port: occupied.port,
        allowHtml: false,
        editRunner: undefined
      });

      expect(info.port).not.toBe(occupied.port);
      expect(info.url).toBe(`http://100.64.0.1:${info.port}/?file=a.md&token=${info.editToken}`);

      const response = await fetch(`http://127.0.0.1:${info.port}/?file=a.md&token=${info.editToken}`);
      expect(response.status).toBe(200);
    } finally {
      await closeServer(occupied.server);
    }
  });

  it("tracks opened files and closes them through the HTTP API", async () => {
    const port = await getFreePort();
    const info = await previewServer.start({
      root,
      file: "a.md",
      bindHost: "127.0.0.1",
      publicHost: "100.64.0.1",
      port,
      allowHtml: false,
      editRunner: undefined
    });
    await fetch(`http://127.0.0.1:${port}/?file=b.md&token=${info.editToken}`);

    expect(previewServer.getInfo()?.openedFiles).toEqual(["a.md", "b.md"]);

    const response = await fetch(`http://127.0.0.1:${port}/api/open-files?file=a.md&token=${info.editToken}`, {
      method: "DELETE"
    });
    const body = (await response.json()) as { readonly nextFile?: string };

    expect(response.status).toBe(200);
    expect(body.nextFile).toBe("b.md");
    expect(previewServer.getInfo()?.openedFiles).toEqual(["b.md"]);
  });

  it("requires a token for browser edit requests", async () => {
    const port = await getFreePort();
    const seenRequests: BrowserEditRequest[] = [];
    const info = await previewServer.start({
      root,
      file: "a.md",
      bindHost: "127.0.0.1",
      publicHost: "100.64.0.1",
      port,
      allowHtml: false,
      editRunner: (request): Promise<EditRunResult> => {
        seenRequests.push(request);
        return Promise.resolve({
          provider: "test",
          summary: "updated"
        });
      }
    });

    const rejected = await fetch(`http://127.0.0.1:${port}/api/edit-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "a.md",
        selectedText: "A",
        comment: "Make it stronger."
      })
    });
    expect(rejected.status).toBe(403);

    const accepted = await fetch(`http://127.0.0.1:${port}/api/edit-requests?token=${info.editToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "a.md",
        selectedText: "A",
        comment: "Make it stronger."
      })
    });

    expect(accepted.status).toBe(202);
    await waitFor(() => seenRequests.length === 1);
    expect(seenRequests[0]?.file).toBe("a.md");
  });
});

async function getFreePort(): Promise<number> {
  const occupied = await listenOnFreePort();
  await closeServer(occupied.server);
  return occupied.port;
}

function listenOnFreePort(): Promise<{ server: ReturnType<typeof createServer>; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address !== null) {
        resolve({ server, port: address.port });
        return;
      }
      server.close(() => reject(new Error("Could not allocate a free port.")));
    });
    server.on("error", reject);
  });
}

function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for condition.");
}
