import * as vscode from "vscode";

import type { HostMode, PreviewConfig } from "./types";

const SECTION = "tailnetMarkdownPreview";

function parseHostMode(value: string): HostMode {
  if (value === "tailnet" || value === "localhost") {
    return value;
  }
  throw new Error(`Unsupported host mode: ${value}`);
}

export function readPreviewConfig(): PreviewConfig {
  const config = vscode.workspace.getConfiguration(SECTION);
  const port = config.get<number>("port", 8787);
  const hostMode = parseHostMode(config.get<string>("hostMode", "tailnet"));
  const configuredBinary = config.get<string>("tailscaleBinary", "").trim();

  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("tailnetMarkdownPreview.port must be between 1024 and 65535.");
  }

  return {
    port,
    hostMode,
    tailscaleBinary: configuredBinary.length > 0 ? configuredBinary : undefined,
    allowHtml: config.get<boolean>("allowHtml", false),
    autoOpenLocalBrowser: config.get<boolean>("autoOpenLocalBrowser", false)
  };
}
