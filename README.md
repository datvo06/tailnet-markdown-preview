# Tailnet Markdown Preview

Currently, VS Code and Cursor render Markdown inside an editor WebView. That works on the machine running the editor, but an Android device on Tailscale cannot open that WebView directly.

This extension starts a small HTTP preview server from inside VS Code or Cursor. The Android device opens that server through Tailscale, so the workflow becomes: edit Markdown on the laptop, save, then read the rendered page on the phone.

## What it does

- Renders `.md` and `.markdown` files with tables, code blocks, links, images, and task lists.
- Serves local images and media from the selected workspace root.
- Auto-refreshes connected browsers when the Markdown file changes.
- Can bind directly to the machine's Tailscale IPv4 address.
- Can also run through `tailscale serve --bg` when you want a MagicDNS HTTPS URL.

## Install from source

```bash
npm install
npm run package
```

Then install the generated `.vsix` in VS Code or Cursor:

```bash
code --install-extension tailnet-markdown-preview-0.1.0.vsix
cursor --install-extension tailnet-markdown-preview-0.1.0.vsix
```

The command line install is optional. You can also use the Extensions panel and choose "Install from VSIX".

## Use it

Open a Markdown file, then run:

```text
Tailnet Markdown Preview: Start Current File
```

With the default settings, the extension asks Tailscale for this machine's IPv4 address and starts a URL like:

```text
http://100.x.y.z:8787/?file=README.md
```

Open that URL on Android while the Android device is signed into the same tailnet.

## Tailscale Serve mode

Run this command when you want a MagicDNS HTTPS URL:

```text
Tailnet Markdown Preview: Start with Tailscale Serve
```

This starts the local preview server on `127.0.0.1`, then runs:

```bash
tailscale serve --bg 8787
```

The resulting URL should look like:

```text
https://your-machine.your-tailnet.ts.net/?file=README.md
```

Note: this updates the Tailscale Serve config for the selected port. If another service is already using that Serve route, choose a different port first.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `tailnetMarkdownPreview.port` | `8787` | HTTP server port. |
| `tailnetMarkdownPreview.hostMode` | `tailnet` | Use `tailnet` for direct Tailscale IP access, or `localhost` for local-only preview. |
| `tailnetMarkdownPreview.tailscaleBinary` | empty | Optional path to the Tailscale CLI. The extension also checks the macOS app CLI path. |
| `tailnetMarkdownPreview.allowHtml` | `false` | Allow raw HTML inside Markdown. Keep it off for untrusted files. |
| `tailnetMarkdownPreview.autoOpenLocalBrowser` | `false` | Open the preview URL locally after start. |

## Development

```bash
npm run check
npm run package
```

`npm run check` compiles TypeScript, runs ESLint, runs unit tests, and checks for generated files or local paths.
