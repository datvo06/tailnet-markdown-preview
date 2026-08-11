export type HostMode = "tailnet" | "localhost";

export interface PreviewConfig {
  readonly port: number;
  readonly hostMode: HostMode;
  readonly tailscaleBinary: string | undefined;
  readonly allowHtml: boolean;
  readonly autoOpenLocalBrowser: boolean;
}

export interface PreviewTarget {
  readonly root: string;
  readonly file: string;
  readonly label: string;
}

export interface PreviewServerOptions {
  readonly root: string;
  readonly file: string;
  readonly host: string;
  readonly port: number;
  readonly allowHtml: boolean;
}

export interface PreviewServerInfo {
  readonly root: string;
  readonly file: string;
  readonly host: string;
  readonly port: number;
  readonly url: string;
  readonly tailscaleServeUrl: string | undefined;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
}
