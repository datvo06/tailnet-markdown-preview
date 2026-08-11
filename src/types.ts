export type HostMode = "tailnet" | "localhost";
export type EditProvider = "auto" | "codex" | "claude" | "queue";

export interface PreviewConfig {
  readonly port: number;
  readonly hostMode: HostMode;
  readonly tailscaleBinary: string | undefined;
  readonly allowHtml: boolean;
  readonly autoOpenLocalBrowser: boolean;
  readonly editProvider: EditProvider;
  readonly editModel: string | undefined;
  readonly codexBinary: string;
  readonly claudeBinary: string;
  readonly editTimeoutSeconds: number;
}

export interface PreviewTarget {
  readonly root: string;
  readonly file: string;
  readonly label: string;
}

export interface PreviewServerOptions {
  readonly root: string;
  readonly file: string;
  readonly bindHost: string;
  readonly publicHost: string;
  readonly port: number;
  readonly allowHtml: boolean;
  readonly editRunner: EditRunner | undefined;
}

export interface PreviewServerInfo {
  readonly root: string;
  readonly file: string;
  readonly bindHost: string;
  readonly publicHost: string;
  readonly port: number;
  readonly url: string;
  readonly tailscaleServeUrl: string | undefined;
  readonly openedFiles: readonly string[];
  readonly editToken: string;
}

export type EditRequestStatus = "queued" | "running" | "succeeded" | "failed";

export interface BrowserEditRequest {
  readonly id: string;
  readonly root: string;
  readonly file: string;
  readonly selectedText: string;
  readonly comment: string;
  readonly createdAt: string;
}

export interface EditRequestRecord extends BrowserEditRequest {
  readonly status: EditRequestStatus;
  readonly provider: string;
  readonly updatedAt: string;
  readonly summary: string | undefined;
  readonly error: string | undefined;
}

export interface EditRunResult {
  readonly provider: string;
  readonly summary: string;
}

export type EditRunner = (request: BrowserEditRequest) => Promise<EditRunResult>;

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
}
