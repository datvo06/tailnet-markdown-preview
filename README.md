# Tailnet Markdown Preview

Currently, VS Code and Cursor render Markdown inside an editor WebView. That works on the machine running the editor, but an Android device on Tailscale cannot open that WebView directly.

This extension starts a small HTTP preview server from inside VS Code or Cursor. The Android device opens that server through Tailscale, so the workflow becomes: edit Markdown on the laptop, save, then read the rendered page on the phone.

## What it does

- Renders `.md` and `.markdown` files with tables, code blocks, links, images, and task lists.
- Serves local images and media from the selected workspace root.
- Auto-refreshes connected browsers when the Markdown file changes.
- Uses the machine's current Tailscale IPv4 address when the preview starts.
- Falls back to the next available port when the configured port is already in use.
- Keeps a browser-side list of opened previews and lets you close entries from that list.
- Shows the local workspace root, current directory, breadcrumbs, and folder navigation in the browser.
- Lets the browser submit highlighted-text edit requests for a Markdown file.
- Shows edit request status with elapsed time while a request is queued, running, or finished.
- Can route browser edit requests through Codex CLI, Claude Code, or a queue-only mode.
- Can try `tailscale serve --bg --set-path` for a MagicDNS HTTPS URL, then falls back to the direct Tailscale IP if Serve is disabled.

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

If the Tailscale address changes later, run the start command again. The extension asks `tailscale ip -4` each time it starts, so it does not reuse an old `100.x.y.z` address.

If the configured port is already in use, the extension tries the next ports and copies the URL with the actual port. This is useful when both VS Code and Cursor have preview servers running, or when an older extension host still owns `8787`.

Starting another Markdown file in the same workspace adds it to the "Open previews" list instead of replacing the running server. The browser UI can close files from that list. Closing a file removes it from the preview list; it does not close the editor tab in VS Code or Cursor.

The browser sidebar shows the workspace name, absolute local root, current directory, open previews, folder navigation, and all Markdown files. Folder links open the first Markdown file under that folder, which makes it easy to move around the repo from Android without guessing where the preview server was started.

## Browser edit requests

Open the copied preview URL, select text in the rendered Markdown, then choose "Comment". The browser sends the selected rendered text plus your comment back to the local extension server.

On Android, long-press and adjust the text selection handles. A compact comment action appears after the browser finalizes the selection. The comment editor opens as a phone-friendly bottom sheet; on larger screens it opens near the selected text.

After submitting, watch the "Edit requests" list in the browser. It shows whether each request is queued, running, succeeded, or failed, plus elapsed time. There is no exact ETA because Codex and Claude runtime depends on the model, repo size, and edit request, but the elapsed timer tells you whether the request is still moving.

By default, edit requests use `auto` mode:

1. Try Codex CLI through `codex exec`.
2. If Codex is not available, try Claude Code through `claude --print`.
3. If neither CLI is available, keep the request queued in the browser status list.

The extension does not inject text into an already-running terminal TUI. That would depend on brittle terminal automation. It uses each CLI's non-interactive mode instead, which is the stable route for local automation.

Copied preview URLs include a random token. Browser edit and close actions require that token, so another tailnet device cannot submit edits by guessing the server address.

## Tailscale Serve mode

Run this command when you want to try a MagicDNS HTTPS URL:

```text
Tailnet Markdown Preview: Start with Tailscale Serve
```

This starts the local preview server on `127.0.0.1`, then runs:

```bash
tailscale serve --bg --set-path=/md-workspace-hash 8787
```

If Tailscale Serve is enabled on the tailnet, the resulting URL should look like:

```text
https://your-machine.your-tailnet.ts.net/md-workspace-hash/?file=README.md
```

If Tailscale Serve is not enabled, the extension falls back to the direct current Tailscale IP URL, for example `http://100.x.y.z:8787/?file=README.md`.

Tailscale Serve config is machine-level, so mounting every repo at `/` would make separate workspaces fight each other. This extension derives a stable `/md-...` path from the selected workspace root and mounts that path instead. Direct tailnet mode is still the most reliable way to run multiple repos at once because each server can use its own chosen port.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `tailnetMarkdownPreview.port` | `8787` | HTTP server port. |
| `tailnetMarkdownPreview.hostMode` | `tailnet` | Use `tailnet` to listen on all interfaces and publish the current Tailscale IP, or `localhost` for local-only preview. |
| `tailnetMarkdownPreview.tailscaleBinary` | empty | Optional path to the Tailscale CLI. The extension also checks the macOS app CLI path. |
| `tailnetMarkdownPreview.allowHtml` | `false` | Allow raw HTML inside Markdown. Keep it off for untrusted files. |
| `tailnetMarkdownPreview.autoOpenLocalBrowser` | `false` | Open the preview URL locally after start. |
| `tailnetMarkdownPreview.editProvider` | `auto` | Use `auto`, `codex`, `claude`, or `queue` for browser edit requests. |
| `tailnetMarkdownPreview.editModel` | empty | Optional model for the selected edit agent. Leave empty, or set `latest`, to let the CLI use its current default model. |
| `tailnetMarkdownPreview.codexBinary` | `codex` | Command or absolute path for Codex CLI. |
| `tailnetMarkdownPreview.claudeBinary` | `claude` | Command or absolute path for Claude Code. |
| `tailnetMarkdownPreview.editTimeoutSeconds` | `600` | Maximum runtime for one browser-submitted edit request. |

## Development

```bash
npm run check
npm run package
```

`npm run check` compiles TypeScript, runs ESLint, runs unit tests, and checks for generated files or local paths.
