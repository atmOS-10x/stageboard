import { execSync, spawn, type ChildProcess } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { AgentConfig } from "../core/config"
import type { Job } from "../core/protocol"

export type AgentRun = {
  externalId?: string
  externalUrl?: string
  done: Promise<{ ok: boolean; error?: string }>
  cancel: () => void
  detach?: () => void
}

export type McpLaunch = { command: string; args: string[] }

export type AgentContext = {
  cwd: string
  log: (line: string) => void
  mcp?: McpLaunch
}

export type AgentProvider = {
  name: string
  start(job: Job, prompt: string, ctx: AgentContext): Promise<AgentRun>
}

function pipeLines(child: ChildProcess, onLine: (line: string) => void) {
  let buf = ""
  const onData = (chunk: Buffer) => {
    buf += chunk.toString()
    let i: number
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (line) onLine(line)
    }
  }
  child.stdout?.on("data", onData)
  child.stderr?.on("data", onData)
}

function exitPromise(child: ChildProcess): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    child.on("error", (err) => resolve({ ok: false, error: err.message }))
    child.on("exit", (code, signal) =>
      resolve(code === 0 ? { ok: true } : { ok: false, error: signal ? `killed (${signal})` : `exit code ${code}` }),
    )
  })
}

function claudeHeadless(config: Extract<AgentConfig, { provider: "claude" }>, prompt: string, ctx: AgentContext): AgentRun {
  const args = [
    "-p",
    prompt,
    "--permission-mode",
    config.permissionMode ?? "acceptEdits",
    "--output-format",
    "stream-json",
    "--verbose",
    ...claudeMcpArgs(ctx.mcp),
    ...(config.model ? ["--model", config.model] : []),
    ...(config.extraArgs ?? []),
  ]
  const child = spawn("claude", args, { cwd: ctx.cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] })
  pipeLines(child, (line) => {
    try {
      const event = JSON.parse(line)
      if (event.type === "assistant") {
        for (const part of event.message?.content ?? []) {
          if (part.type === "text" && part.text) ctx.log(part.text.slice(0, 300))
          if (part.type === "tool_use") ctx.log(`→ ${part.name}`)
        }
      }
    } catch {
      ctx.log(line.slice(0, 300))
    }
  })
  return { done: exitPromise(child), cancel: () => child.kill("SIGTERM") }
}

function claudeMcpArgs(mcp: McpLaunch | undefined): string[] {
  if (!mcp) return []
  return ["--mcp-config", JSON.stringify({ mcpServers: { stageboard: { command: mcp.command, args: mcp.args } } })]
}

function codexMcpArgs(mcp: McpLaunch | undefined): string[] {
  if (!mcp) return []
  return ["-c", `mcp_servers.stageboard.command=${JSON.stringify(mcp.command)}`, "-c", `mcp_servers.stageboard.args=${JSON.stringify(mcp.args)}`]
}

function runText(cmd: string, args: string[], cwd: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    child.stdout.on("data", (d) => (out += d))
    child.stderr.on("data", (d) => (out += d))
    child.on("error", (e) => resolve({ code: 1, out: e.message }))
    child.on("exit", (code) => resolve({ code: code ?? 1, out }))
  })
}

const BUSY = new Set(["busy", "running", "working", "starting", "active", "thinking"])

async function claudeBackground(
  config: Extract<AgentConfig, { provider: "claude" }>,
  job: Job,
  prompt: string,
  ctx: AgentContext,
): Promise<AgentRun> {
  const name = `stageboard: ${job.note.slice(0, 50)}`
  const args = [
    "--bg",
    "-n",
    name,
    "--permission-mode",
    config.permissionMode ?? "acceptEdits",
    ...claudeMcpArgs(ctx.mcp),
    ...(config.model ? ["--model", config.model] : []),
    ...(config.extraArgs ?? []),
    prompt,
  ]
  const started = await runText("claude", args, ctx.cwd)
  if (started.code !== 0) throw new Error(started.out.trim() || "claude --bg failed")
  const id = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(started.out)?.[0] ?? /\b[a-z0-9]{6,}\b/i.exec(started.out.trim().split("\n").pop() ?? "")?.[0]
  ctx.log(started.out.trim().split("\n").slice(-2).join(" ").slice(0, 300))
  let cancelled = false
  const done = (async () => {
    let seen = false
    await new Promise((r) => setTimeout(r, 3000))
    while (!cancelled) {
      const list = await runText("claude", ["agents", "--json", "--all"], ctx.cwd)
      try {
        const sessions = JSON.parse(list.out) as Record<string, unknown>[]
        const match = sessions.find((s) => [s.id, s.sessionId, s.jobId, s.shortId].some((v) => v && id && String(v).startsWith(id))) ??
          sessions.find((s) => s.name === name)
        if (match) {
          seen = true
          const status = String(match.status ?? "").toLowerCase()
          if (/fail|error/.test(status)) return { ok: false, error: `claude session ${status}` }
          if (!BUSY.has(status)) return { ok: true }
        } else if (seen) {
          return { ok: true }
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 4000))
    }
    return { ok: false, error: "cancelled" }
  })()
  return {
    externalId: id,
    done,
    cancel: () => {
      cancelled = true
      if (id) spawn("claude", ["stop", id], { cwd: ctx.cwd, stdio: "ignore" })
    },
    detach: () => {
      cancelled = true
    },
  }
}

function claudeProvider(config: Extract<AgentConfig, { provider: "claude" }>): AgentProvider {
  return {
    name: config.background === false ? "claude" : "claude (background)",
    async start(job, prompt, ctx) {
      if (config.background === false) return claudeHeadless(config, prompt, ctx)
      return claudeBackground(config, job, prompt, ctx)
    },
  }
}

function codexProvider(config: Extract<AgentConfig, { provider: "codex" }>): AgentProvider {
  return {
    name: "codex",
    async start(_job, prompt, ctx) {
      const args = [
        "exec",
        "--json",
        "-C",
        ctx.cwd,
        "--sandbox",
        config.sandbox ?? "workspace-write",
        ...codexMcpArgs(ctx.mcp),
        ...(config.model ? ["-m", config.model] : []),
        ...(config.extraArgs ?? []),
        prompt,
      ]
      const child = spawn("codex", args, { cwd: ctx.cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] })
      pipeLines(child, (line) => {
        try {
          const event = JSON.parse(line)
          const msg = event.msg ?? event.item ?? event
          const text = msg.message ?? msg.text ?? msg.content
          if (typeof text === "string" && text.trim()) ctx.log(text.slice(0, 300))
          else if (msg.type && /command|exec|tool/.test(String(msg.type))) ctx.log(`→ ${msg.type}`)
        } catch {
          ctx.log(line.slice(0, 300))
        }
      })
      return { done: exitPromise(child), cancel: () => child.kill("SIGTERM") }
    },
  }
}

function runJson(cmd: string, args: string[], cwd: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    let err = ""
    child.stdout.on("data", (d) => (out += d))
    child.stderr.on("data", (d) => (err += d))
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code !== 0) return reject(new Error(err.trim() || out.trim() || `${cmd} exited ${code}`))
      try {
        resolve(JSON.parse(out))
      } catch {
        reject(new Error(`Could not parse ${cmd} output: ${out.slice(0, 300)}`))
      }
    })
  })
}

const ATMOS_DONE = new Set(["completed", "complete", "succeeded", "success", "idle", "finished", "done", "awaiting_input"])
const ATMOS_FAILED = new Set(["failed", "error", "errored", "cancelled", "canceled", "aborted", "closed"])

function pick(obj: any, ...keys: string[]): any {
  for (const k of keys) {
    const v = k.split(".").reduce((o, p) => (o == null ? o : o[p]), obj)
    if (v != null) return v
  }
  return undefined
}

function currentBranch(cwd: string): string | undefined {
  try {
    return execSync("git branch --show-current", { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || undefined
  } catch {
    return undefined
  }
}

function worktreePreamble(cwd: string): string {
  const branch = currentBranch(cwd)
  return [
    "## Where to work",
    `Make every change in the existing git worktree at \`${cwd}\`${branch ? ` (branch \`${branch}\`)` : ""}, not in a new worktree: the user is watching that checkout live.`,
    branch ? `Before anything else, move into it with the worktree_enter tool (branch \`${branch}\`, create false). If that tool is unavailable, cd there and use absolute paths.` : "cd there and use absolute paths.",
    "",
    "",
  ].join("\n")
}

function atmosProvider(config: Extract<AgentConfig, { provider: "atmos" }>): AgentProvider {
  return {
    name: "atmos",
    async start(job, prompt, ctx) {
      if (config.sameWorktree !== false) prompt = worktreePreamble(ctx.cwd) + prompt
      const args = [
        "session",
        "new",
        "--json",
        "--title",
        `stageboard · ${job.note.slice(0, 60)}`,
        "--device",
        config.device ?? "current",
        "--harness",
        config.harness ?? "claude_local",
        "--harness-permission-mode",
        config.permissionMode ?? "acceptEdits",
        ...(config.project ? ["--project", config.project] : []),
        ...(config.checkout ? ["--checkout", config.checkout] : []),
        ...(config.model ? ["--model", config.model] : []),
        "-p",
        prompt,
      ]
      let created: any
      let child = false
      try {
        created = await runJson("atmos", args, ctx.cwd)
      } catch (e) {
        if (!/user_credentials_required|requires a user session/.test((e as Error).message)) throw e
        ctx.log("No atmOS user login here; starting a child session of the current atmOS session instead")
        child = true
        created = await runJson(
          "atmos",
          [
            "session",
            "subagent",
            "create",
            "--json",
            "--subagent",
            config.harness === "codex_local" ? "codex" : "claude",
            ...(config.project ? ["--project", config.project] : []),
            prompt,
          ],
          ctx.cwd,
        )
      }
      const id: string | undefined = pick(created, "id", "session.id", "session_id", "child_session_id", "child.id", "data.id")
      if (!id) throw new Error(`atmos did not return a session id: ${JSON.stringify(created).slice(0, 300)}`)
      const url: string | undefined = pick(created, "url", "web_url", "session.url", "links.web")
      ctx.log(`atmOS session ${id}`)
      let cancelled = false
      let lastStatus = ""
      const done = (async () => {
        await new Promise((r) => setTimeout(r, 4000))
        while (!cancelled) {
          try {
            const s = await runJson("atmos", child ? ["session", "subagent", "wait", id, "--json", "--max-events", "1"] : ["session", "get", id, "--json"], ctx.cwd)
            const status = String(pick(s, "status", "session.status", "child.status", "state", "run_status") ?? "").toLowerCase()
            const turnActive = pick(s, "active_turn", "session.active_turn", "turn_active", "is_running")
            if (status !== lastStatus) {
              ctx.log(`atmOS status: ${status}`)
              lastStatus = status
            }
            if (ATMOS_FAILED.has(status)) return { ok: false, error: `atmOS session ${status}` }
            if (ATMOS_DONE.has(status) && !turnActive) return { ok: true }
          } catch (e) {
            ctx.log(`atmOS poll failed: ${(e as Error).message.slice(0, 200)}`)
          }
          await new Promise((r) => setTimeout(r, 5000))
        }
        return { ok: false, error: "cancelled" }
      })()
      return {
        externalId: id,
        externalUrl: url,
        done,
        cancel: () => {
          cancelled = true
          spawn("atmos", ["session", "cancel", id], { cwd: ctx.cwd, stdio: "ignore" })
        },
        detach: () => {
          cancelled = true
        },
      }
    },
  }
}

function commandProvider(config: Extract<AgentConfig, { provider: "command" }>): AgentProvider {
  return {
    name: "command",
    async start(job, prompt, ctx) {
      const promptFile = path.join(os.tmpdir(), `stageboard-${job.id}.md`)
      fs.writeFileSync(promptFile, prompt)
      const command = config.command.replaceAll("{promptFile}", promptFile).replaceAll("{jobId}", job.id)
      const child = spawn(command, {
        cwd: ctx.cwd,
        shell: true,
        env: { ...process.env, STAGEBOARD_PROMPT_FILE: promptFile, STAGEBOARD_JOB_ID: job.id },
        stdio: ["ignore", "pipe", "pipe"],
      })
      pipeLines(child, (line) => ctx.log(line.slice(0, 300)))
      return { done: exitPromise(child), cancel: () => child.kill("SIGTERM") }
    },
  }
}

export function createProvider(config: AgentConfig | undefined): AgentProvider {
  const resolved = config ?? { provider: "claude" as const }
  if (resolved.provider === "atmos") return atmosProvider(resolved)
  if (resolved.provider === "command") return commandProvider(resolved)
  if (resolved.provider === "codex") return codexProvider(resolved)
  return claudeProvider(resolved)
}
