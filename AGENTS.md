# Tailnet Markdown Preview Guide

## Overview

This repo contains a small VS Code extension for serving Markdown previews to devices on the same Tailscale network. Cursor can install the same extension package because it supports the VS Code extension API used here.

## Layout

- `src/extension.ts`: VS Code command wiring and UI.
- `src/previewServer.ts`: HTTP server, live reload stream, workspace file serving.
- `src/markdown.ts`: Markdown rendering setup.
- `src/tailscale.ts`: Tailscale CLI detection and MagicDNS helpers.
- `test/`: Unit tests for path safety, HTML generation, and Tailscale parsing.
- `scripts/check-hygiene.mjs`: Repository hygiene checks.

## Quality Rules

- Keep the extension TypeScript strict and typed at module boundaries.
- Parse configuration once in `src/config.ts`, then pass typed values.
- Do not expose files outside the selected workspace root.
- Do not add generated editor state, profiles, VSIX files, or local paths to git.
- Run `npm run check` before packaging.

## Documentation

Docs should stay concrete. Start from the problem, name the cost or limitation, then give the setup path. Avoid decorative claims and avoid en dashes or em dashes.
