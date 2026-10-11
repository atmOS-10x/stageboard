import { spawn, type ChildProcess } from "node:child_process"
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
}

export type AgentContext = {
  cwd: string
  log: (line: string) => void
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

function claudeProvider(config: Extract<AgentConfig, { provider: "claude" }>): AgentProvider {
  return {
    name: "claude",
    async start(_job, prompt, ctx) {
      const args = [
        "-p",
        prompt,
        "--permission-mode",
        config.permissionMode ?? "acceptEdits",
        "--output-format",
        "stream-json",
        "--verbose",
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

function atmosProvider(config: Extract<AgentConfig, { provider: "atmos" }>): AgentProvider {
  return {
    name: "atmos",
    async start(job, prompt, ctx) {
      const promptFile = path.join(os.tmpdir(), `stageboard-${job.id}.md`)
      fs.writeFileSync(promptFile, prompt)
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
      const created = await runJson("atmos", args, ctx.cwd)
      const id: string | undefined = pick(created, "id", "session.id", "session_id", "data.id")
      if (!id) throw new Error(`atmos did not return a session id: ${JSON.stringify(created).slice(0, 300)}`)
      const url: string | undefined = pick(created, "url", "web_url", "session.url", "links.web")
      ctx.log(`atmOS session ${id}`)
      let cancelled = false
      let lastStatus = ""
      const done = (async () => {
        await new Promise((r) => setTimeout(r, 4000))
        while (!cancelled) {
          try {
            const s = await runJson("atmos", ["session", "get", id, "--json"], ctx.cwd)
            const status = String(pick(s, "status", "session.status", "state", "run_status") ?? "").toLowerCase()
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
  return claudeProvider(resolved)
}
