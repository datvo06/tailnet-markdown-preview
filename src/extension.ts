import * as path from "path";
import * as vscode from "vscode";

import { readPreviewConfig } from "./config";
import { isMarkdownPath, relativeToRoot } from "./paths";
import { buildPreviewUrl, PreviewServer } from "./previewServer";
import {
  detectTailscaleDnsName,
  detectTailscaleIp,
  findTailscaleBinary,
  startTailscaleServe
} from "./tailscale";
import type { PreviewConfig, PreviewServerInfo, PreviewTarget } from "./types";

const server = new PreviewServer();

interface ResolvedPreviewHost {
  readonly bindHost: string;
  readonly publicHost: string;
}

interface StartPreviewOptions {
  readonly offerActions: boolean;
}

let output: vscode.OutputChannel;
let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel("Tailnet Markdown Preview");
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = "tailnetMarkdownPreview.copyUrl";
  context.subscriptions.push(output, statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand("tailnetMarkdownPreview.startCurrent", () => startCurrentFile()),
    vscode.commands.registerCommand("tailnetMarkdownPreview.start", () => pickFileAndStart()),
    vscode.commands.registerCommand("tailnetMarkdownPreview.startViaTailscaleServe", () =>
      pickFileAndStartViaServe()
    ),
    vscode.commands.registerCommand("tailnetMarkdownPreview.stop", () => stopPreview()),
    vscode.commands.registerCommand("tailnetMarkdownPreview.copyUrl", () => copyCurrentUrl()),
    vscode.commands.registerCommand("tailnetMarkdownPreview.open", () => openCurrentUrl())
  );
}

export async function deactivate(): Promise<void> {
  await server.stop();
}

async function startCurrentFile(): Promise<void> {
  const uri = vscode.window.activeTextEditor?.document.uri;
  if (uri === undefined || uri.scheme !== "file" || !isMarkdownPath(uri.fsPath)) {
    await vscode.window.showWarningMessage("Open a Markdown file before starting the preview.");
    return;
  }

  await startPreview(targetFromUri(uri), readPreviewConfig());
}

async function pickFileAndStart(): Promise<void> {
  const target = await pickMarkdownTarget();
  if (target === undefined) {
    return;
  }

  await startPreview(target, readPreviewConfig());
}

async function pickFileAndStartViaServe(): Promise<void> {
  const target = await pickMarkdownTarget();
  if (target === undefined) {
    return;
  }

  const choice = await vscode.window.showWarningMessage(
    "This runs `tailscale serve --bg` and updates this machine's Tailscale Serve config for the selected port.",
    { modal: true },
    "Continue"
  );
  if (choice !== "Continue") {
    return;
  }

  const config = readPreviewConfig();
  const info = await startPreview(target, { ...config, hostMode: "localhost" }, { offerActions: false });
  const binary = await findTailscaleBinary(config.tailscaleBinary);
  try {
    await startTailscaleServe(binary, config.port);
  } catch (error: unknown) {
    output.appendLine(`Tailscale Serve failed. Falling back to direct Tailscale IP.`);
    output.appendLine(errorToMessage(error));
    await vscode.window.showWarningMessage(
      "Tailscale Serve is not available. Falling back to this machine's current Tailscale IP."
    );
    await startPreview(target, { ...config, hostMode: "tailnet" });
    return;
  }

  const dnsName = await detectTailscaleDnsName(binary);

  if (dnsName === undefined) {
    await vscode.window.showWarningMessage(
      "Tailscale Serve started, but the MagicDNS name could not be detected. Run `tailscale serve status` for the URL."
    );
    return;
  }

  const serveUrl = buildPreviewUrl(dnsName, 443, info.file).replace(/^http:/, "https:").replace(":443/", "/");
  const updated = server.setTailscaleServeUrl(serveUrl);
  updateStatus(updated);
  await offerUrlActions(serveUrl);
}

async function startPreview(
  target: PreviewTarget,
  config: PreviewConfig,
  options: StartPreviewOptions = { offerActions: true }
): Promise<PreviewServerInfo> {
  const host = await resolveHost(config);
  const info = await server.start({
    root: target.root,
    file: target.file,
    bindHost: host.bindHost,
    publicHost: host.publicHost,
    port: config.port,
    allowHtml: config.allowHtml
  });

  output.appendLine(`Serving ${target.label}`);
  output.appendLine(`Root: ${target.root}`);
  output.appendLine(`URL: ${info.url}`);
  updateStatus(info);

  if (options.offerActions && config.autoOpenLocalBrowser) {
    await vscode.env.openExternal(vscode.Uri.parse(info.url));
  }

  if (options.offerActions) {
    await offerUrlActions(info.url);
  }
  return info;
}

async function resolveHost(config: PreviewConfig): Promise<ResolvedPreviewHost> {
  if (config.hostMode === "localhost") {
    return {
      bindHost: "127.0.0.1",
      publicHost: "127.0.0.1"
    };
  }

  const binary = await findTailscaleBinary(config.tailscaleBinary);
  const publicHost = await detectTailscaleIp(binary);
  return {
    bindHost: "0.0.0.0",
    publicHost
  };
}

async function stopPreview(): Promise<void> {
  await server.stop();
  statusBar.hide();
  await vscode.window.showInformationMessage("Tailnet Markdown Preview stopped.");
}

async function copyCurrentUrl(): Promise<void> {
  const url = currentPublicUrl();
  if (url === undefined) {
    await vscode.window.showWarningMessage("No Tailnet Markdown Preview server is running.");
    return;
  }

  await vscode.env.clipboard.writeText(url);
  await vscode.window.showInformationMessage("Tailnet Markdown Preview URL copied.");
}

async function openCurrentUrl(): Promise<void> {
  const url = currentPublicUrl();
  if (url === undefined) {
    await vscode.window.showWarningMessage("No Tailnet Markdown Preview server is running.");
    return;
  }

  await vscode.env.openExternal(vscode.Uri.parse(url));
}

function currentPublicUrl(): string | undefined {
  const info = server.getInfo();
  return info?.tailscaleServeUrl ?? info?.url;
}

async function offerUrlActions(url: string): Promise<void> {
  const action = await vscode.window.showInformationMessage(
    `Tailnet Markdown Preview started: ${url}`,
    "Copy URL",
    "Open"
  );
  if (action === "Copy URL") {
    await vscode.env.clipboard.writeText(url);
  }
  if (action === "Open") {
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }
}

function updateStatus(info: PreviewServerInfo | undefined): void {
  if (info === undefined) {
    statusBar.hide();
    return;
  }

  statusBar.text = "$(eye) Markdown preview";
  statusBar.tooltip = currentPublicUrl() ?? info.url;
  statusBar.show();
}

function errorToMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

async function pickMarkdownTarget(): Promise<PreviewTarget | undefined> {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri !== undefined && activeUri.scheme === "file" && isMarkdownPath(activeUri.fsPath)) {
    return targetFromUri(activeUri);
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders === undefined || workspaceFolders.length === 0) {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        Markdown: ["md", "markdown"]
      }
    });
    const uri = selected?.[0];
    return uri === undefined ? undefined : targetFromUri(uri);
  }

  const files = await vscode.workspace.findFiles(
    "**/*.{md,markdown}",
    "{**/.git/**,**/node_modules/**,**/dist/**,**/coverage/**}",
    1000
  );

  const picks = files.map((uri) => ({
    label: vscode.workspace.asRelativePath(uri, false),
    description: path.dirname(uri.fsPath),
    target: targetFromUri(uri)
  }));

  const picked = await vscode.window.showQuickPick(picks, {
    matchOnDescription: true,
    placeHolder: "Choose a Markdown file to preview"
  });
  return picked?.target;
}

function targetFromUri(uri: vscode.Uri): PreviewTarget {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  const root = workspaceFolder?.uri.fsPath ?? path.dirname(uri.fsPath);
  const file = relativeToRoot(root, uri.fsPath);
  const label = workspaceFolder === undefined ? file : `${workspaceFolder.name}/${file}`;
  return { root, file, label };
}
