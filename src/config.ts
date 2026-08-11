import * as vscode from "vscode";

import type { EditProvider, HostMode, PreviewConfig } from "./types";

const SECTION = "tailnetMarkdownPreview";

function parseHostMode(value: string): HostMode {
  if (value === "tailnet" || value === "localhost") {
    return value;
  }
  throw new Error(`Unsupported host mode: ${value}`);
}

function parseEditProvider(value: string): EditProvider {
  if (value === "auto" || value === "codex" || value === "claude" || value === "queue") {
    return value;
  }
  throw new Error(`Unsupported edit provider: ${value}`);
}

export function readPreviewConfig(): PreviewConfig {
  const config = vscode.workspace.getConfiguration(SECTION);
  const port = config.get<number>("port", 8787);
  const hostMode = parseHostMode(config.get<string>("hostMode", "tailnet"));
  const configuredBinary = config.get<string>("tailscaleBinary", "").trim();
  const editProvider = parseEditProvider(config.get<string>("editProvider", "auto"));
  const editTimeoutSeconds = config.get<number>("editTimeoutSeconds", 600);

  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("tailnetMarkdownPreview.port must be between 1024 and 65535.");
  }
  if (!Number.isInteger(editTimeoutSeconds) || editTimeoutSeconds < 30 || editTimeoutSeconds > 3600) {
    throw new Error("tailnetMarkdownPreview.editTimeoutSeconds must be between 30 and 3600.");
  }

  return {
    port,
    hostMode,
    tailscaleBinary: configuredBinary.length > 0 ? configuredBinary : undefined,
    allowHtml: config.get<boolean>("allowHtml", false),
    autoOpenLocalBrowser: config.get<boolean>("autoOpenLocalBrowser", false),
    editProvider,
    editModel: optionalString(config.get<string>("editModel", "")),
    codexBinary: config.get<string>("codexBinary", "codex"),
    claudeBinary: config.get<string>("claudeBinary", "claude"),
    editTimeoutSeconds
  };
}

function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "latest") {
    return undefined;
  }
  return trimmed;
}
