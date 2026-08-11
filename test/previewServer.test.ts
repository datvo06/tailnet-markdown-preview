import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";
import { createServer } from "net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PreviewServer } from "../src/previewServer";

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
      allowHtml: false
    });

    expect(info.url).toBe(`http://100.64.0.1:${port}/?file=a.md`);

    const response = await fetch(`http://127.0.0.1:${port}/?file=a.md`);
    expect(await response.text()).toContain("Open previews");
  });

  it("tracks opened files and closes them through the HTTP API", async () => {
    const port = await getFreePort();
    await previewServer.start({
      root,
      file: "a.md",
      bindHost: "127.0.0.1",
      publicHost: "100.64.0.1",
      port,
      allowHtml: false
    });
    await fetch(`http://127.0.0.1:${port}/?file=b.md`);

    expect(previewServer.getInfo()?.openedFiles).toEqual(["a.md", "b.md"]);

    const response = await fetch(`http://127.0.0.1:${port}/api/open-files?file=a.md`, {
      method: "DELETE"
    });
    const body = (await response.json()) as { readonly nextFile?: string };

    expect(response.status).toBe(200);
    expect(body.nextFile).toBe("b.md");
    expect(previewServer.getInfo()?.openedFiles).toEqual(["b.md"]);
  });
});

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address !== null) {
        const port = address.port;
        server.close(() => resolve(port));
        return;
      }
      server.close(() => reject(new Error("Could not allocate a free port.")));
    });
    server.on("error", reject);
  });
}
