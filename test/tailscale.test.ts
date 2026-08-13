import { describe, expect, it } from "vitest";

import { buildTailscaleServeArgs, parseDnsNameFromDnsStatus, parseDnsNameFromStatusJson } from "../src/tailscale";

describe("tailscale parsing", () => {
  it("reads DNSName from tailscale status json", () => {
    const raw = JSON.stringify({
      Self: {
        DNSName: "dats-macbook-pro.tail5600e5.ts.net."
      }
    });

    expect(parseDnsNameFromStatusJson(raw)).toBe("dats-macbook-pro.tail5600e5.ts.net");
  });

  it("returns undefined for invalid status json", () => {
    expect(parseDnsNameFromStatusJson("not json")).toBeUndefined();
    expect(parseDnsNameFromStatusJson("{}")).toBeUndefined();
  });

  it("reads MagicDNS from dns status output", () => {
    const raw = "Other devices in your tailnet can reach this device at dats-macbook-pro.tail5600e5.ts.net.";

    expect(parseDnsNameFromDnsStatus(raw)).toBe("dats-macbook-pro.tail5600e5.ts.net");
  });

  it("builds a workspace-specific Serve command", () => {
    expect(buildTailscaleServeArgs(8787, "md-work/")).toEqual([
      "serve",
      "--bg",
      "--set-path=/md-work",
      "8787"
    ]);
  });
});
