import { execFile } from "child_process";
import { existsSync } from "fs";

const MAC_APP_CLI = "/Applications/Tailscale.app/Contents/MacOS/Tailscale";

export async function findTailscaleBinary(configuredPath: string | undefined): Promise<string> {
  const candidates = configuredPath === undefined ? ["tailscale", MAC_APP_CLI] : [configuredPath];

  for (const candidate of candidates) {
    if (candidate.includes("/") && !existsSync(candidate)) {
      continue;
    }
    try {
      await runTailscale(candidate, ["version"], 2000);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error("Could not find the Tailscale CLI. Install it or set tailnetMarkdownPreview.tailscaleBinary.");
}

export async function detectTailscaleIp(binary: string): Promise<string> {
  const stdout = await runTailscale(binary, ["ip", "-4"], 3000);
  const ip = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (ip === undefined) {
    throw new Error("Tailscale is running, but no IPv4 address was reported.");
  }

  return ip;
}

export async function detectTailscaleDnsName(binary: string): Promise<string | undefined> {
  const status = await runTailscale(binary, ["status", "--json"], 3000).catch(() => "");
  const fromJson = parseDnsNameFromStatusJson(status);
  if (fromJson !== undefined) {
    return fromJson;
  }

  const dnsStatus = await runTailscale(binary, ["dns", "status"], 3000).catch(() => "");
  return parseDnsNameFromDnsStatus(dnsStatus);
}

export async function startTailscaleServe(binary: string, port: number, servePath: string): Promise<void> {
  await runTailscale(binary, buildTailscaleServeArgs(port, servePath), 5000);
}

export function buildTailscaleServeArgs(port: number, servePath: string): string[] {
  return ["serve", "--bg", `--set-path=${normalizeServePath(servePath)}`, String(port)];
}

export function parseDnsNameFromStatusJson(raw: string): string | undefined {
  if (raw.trim().length === 0) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (!isObject(parsed) || !isObject(parsed.Self)) {
    return undefined;
  }

  const dnsName = parsed.Self.DNSName;
  if (typeof dnsName !== "string" || dnsName.length === 0) {
    return undefined;
  }

  return dnsName.replace(/\.$/, "");
}

export function parseDnsNameFromDnsStatus(raw: string): string | undefined {
  const match = raw.match(/\bat\s+([a-z0-9][a-z0-9.-]*\.ts\.net)\.?/i);
  return match?.[1]?.replace(/\.$/, "");
}

function runTailscale(binary: string, args: readonly string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      binary,
      [...args],
      {
        encoding: "utf8",
        timeout: timeoutMs,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error !== null) {
          const output = [stdout.trim(), stderr.trim()].filter((part) => part.length > 0).join("\n");
          const detail = output.length > 0 ? output : error.message;
          reject(new Error(detail));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

function normalizeServePath(servePath: string): string {
  const trimmed = servePath.trim();
  if (trimmed.length === 0 || trimmed === "/") {
    return "/";
  }
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/u, "");
}

function isObject(value: unknown): value is { readonly [key: string]: unknown } {
  return typeof value === "object" && value !== null;
}
