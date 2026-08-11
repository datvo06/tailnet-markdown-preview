import { spawn } from "child_process";

import type { BrowserEditRequest, EditRunResult, PreviewConfig } from "./types";

interface AgentCommand {
  readonly provider: "codex" | "claude";
  readonly binary: string;
  readonly args: readonly string[];
}

export function createEditRunner(config: PreviewConfig): ((request: BrowserEditRequest) => Promise<EditRunResult>) | undefined {
  if (config.editProvider === "queue") {
    return undefined;
  }

  return async (request: BrowserEditRequest) => runAgentEdit(request, config);
}

async function runAgentEdit(request: BrowserEditRequest, config: PreviewConfig): Promise<EditRunResult> {
  const command = await resolveAgentCommand(config);
  const prompt = buildMarkdownEditPrompt(request);
  const result = await runCommand(command.binary, command.args, prompt, request.root, config.editTimeoutSeconds);

  return {
    provider: command.provider,
    summary: result.trim().length > 0 ? result.trim() : "Edit completed."
  };
}

async function resolveAgentCommand(config: PreviewConfig): Promise<AgentCommand> {
  const providers = config.editProvider === "auto" ? (["codex", "claude"] as const) : ([config.editProvider] as const);

  for (const provider of providers) {
    if (provider === "codex") {
      const command = codexCommand(config);
      if (await commandExists(command.binary)) {
        return command;
      }
    }
    if (provider === "claude") {
      const command = claudeCommand(config);
      if (await commandExists(command.binary)) {
        return command;
      }
    }
  }

  throw new Error(`No edit agent is available for provider setting '${config.editProvider}'.`);
}

function codexCommand(config: PreviewConfig): AgentCommand {
  const args = [
    "exec",
    "--cd",
    ".",
    "--sandbox",
    "workspace-write",
    "--ask-for-approval",
    "never",
    "--color",
    "never"
  ];
  if (config.editModel !== undefined) {
    args.push("--model", config.editModel);
  }
  args.push("-");

  return {
    provider: "codex",
    binary: config.codexBinary,
    args
  };
}

function claudeCommand(config: PreviewConfig): AgentCommand {
  const args = [
    "--print",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    "Read,Edit,MultiEdit"
  ];
  if (config.editModel !== undefined) {
    args.push("--model", config.editModel);
  }

  return {
    provider: "claude",
    binary: config.claudeBinary,
    args
  };
}

export function buildMarkdownEditPrompt(request: BrowserEditRequest): string {
  return `Edit this Markdown file based on a browser comment.

File: ${request.file}

Selected rendered text:
${request.selectedText}

User comment:
${request.comment}

Instructions:
- Edit only the file named above unless the requested change clearly requires a nearby referenced file.
- Treat the selected rendered text as the anchor. Find the corresponding Markdown source, even if formatting differs.
- Make the smallest coherent edit that satisfies the comment.
- Preserve the document's voice and formatting.
- Do not add unrelated explanation to the Markdown file.
- Finish with a concise summary of what changed.`;
}

function runCommand(
  binary: string,
  args: readonly string[],
  stdin: string,
  cwd: string,
  timeoutSeconds: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [...args], {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Edit agent timed out after ${timeoutSeconds} seconds.`));
    }, timeoutSeconds * 1000);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const out = Buffer.concat(stdout).toString("utf8");
      const err = Buffer.concat(stderr).toString("utf8");
      if (code === 0) {
        resolve(out);
        return;
      }
      reject(new Error([err.trim(), out.trim()].filter((part) => part.length > 0).join("\n")));
    });
    child.stdin.end(stdin);
  });
}

function commandExists(binary: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(binary, ["--version"], {
      stdio: "ignore"
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}
