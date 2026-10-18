import { execSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"
import type { BridgeState, ChangeRequest, Job, VariantFile } from "../core/protocol"
import { createRequire } from "node:module"
import { createProvider, type AgentProvider, type AgentRun, type McpLaunch } from "./agents"
import type { ResolvedConfig } from "./config"
import { buildPrompt } from "./prompt"
import type { Thumbnailer } from "./thumbs"
import { readUpload, writeUpload } from "./uploads"
import { scanVariants, writeVariantsModule } from "./variants"

type Persisted = { selections: Record<string, string>; jobs: Job[] }

const MAX_LOG = 60
const MAX_JOBS = 100

function gitRoot(dir: string): string {
  try {
    return execSync("git rev-parse --show-toplevel", { cwd: dir, stdio: ["ignore", "pipe", "ignore"] }).toString().trim()
  } catch {
    return dir
  }
}

export class Bridge {
  private state: BridgeState
  private runs = new Map<string, AgentRun>()
  private completions = new Map<string, (result: { ok: boolean; error?: string }) => void>()
  private provider: AgentProvider
  private stateFile: string
  private rescanTimer?: ReturnType<typeof setTimeout>
  private listeners = new Set<() => void>()
  private renderer?: Thumbnailer
  readonly agentCwd: string

  constructor(private config: ResolvedConfig) {
    fs.mkdirSync(config.stateDir, { recursive: true })
    this.stateFile = path.join(config.stateDir, "state.json")
    const persisted = this.load()
    this.state = { version: 1, selections: persisted.selections, jobs: persisted.jobs, variants: [] }
    this.provider = createProvider(config.agent)
    this.agentCwd = gitRoot(config.root)
    for (const job of this.state.jobs) {
      if (job.status === "running" || job.status === "queued") {
        job.status = "failed"
        job.error = "stageboard restarted while the agent was running"
      }
    }
  }

  private load(): Persisted {
    try {
      const raw = JSON.parse(fs.readFileSync(this.stateFile, "utf8"))
      return { selections: raw.selections ?? {}, jobs: raw.jobs ?? [] }
    } catch {
      return { selections: {}, jobs: [] }
    }
  }

  private save() {
    const data: Persisted = { selections: this.state.selections, jobs: this.state.jobs.slice(-MAX_JOBS) }
    fs.writeFileSync(this.stateFile, JSON.stringify(data, null, 2))
  }

  private bump() {
    this.state.version++
    this.save()
    this.listeners.forEach((l) => l())
  }

  private mcpLaunch(): McpLaunch | undefined {
    try {
      const require = createRequire(import.meta.url)
      const pkg = require.resolve("stageboard/package.json")
      const cli = path.join(path.dirname(pkg), "dist", "node", "cli.js")
      if (!fs.existsSync(cli)) return undefined
      return { command: process.execPath, args: [cli, "mcp", "--config", this.config.configFile] }
    } catch {
      return undefined
    }
  }

  setRenderer(renderer: Thumbnailer) {
    this.renderer = renderer
  }

  onChange(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState(): BridgeState {
    return this.state
  }

  async refreshVariants(): Promise<boolean> {
    const variants = await scanVariants(this.config)
    const { changed } = await writeVariantsModule(this.config, variants)
    const before = JSON.stringify(this.state.variants)
    this.state.variants = variants
    const matched = this.matchJobs(variants)
    if (changed || matched || before !== JSON.stringify(variants)) {
      this.bump()
      return true
    }
    return false
  }

  scheduleRescan(delay = 150) {
    if (this.rescanTimer) clearTimeout(this.rescanTimer)
    this.rescanTimer = setTimeout(() => void this.refreshVariants(), delay)
  }

  private matchJobs(variants: VariantFile[]): boolean {
    let changed = false
    for (const job of this.state.jobs) {
      const produced = variants.filter((v) => v.job === job.id).map((v) => v.file)
      if (produced.length !== job.producedFiles.length) {
        job.producedFiles = produced
        changed = true
      }
      const of = variants.find((v) => v.job === job.id)?.of
      if (of && !job.variantId) {
        job.variantId = of
        changed = true
      }
    }
    return changed
  }

  select(id: string, key: string) {
    this.state.selections = { ...this.state.selections, [id]: key }
    this.bump()
  }

  private log(job: Job, line: string) {
    job.log = [...job.log, line].slice(-MAX_LOG)
    job.updatedAt = new Date().toISOString()
    this.bump()
  }

  async createJob(request: ChangeRequest): Promise<Job> {
    const now = new Date().toISOString()
    const job: Job = {
      id: randomUUID().slice(0, 8),
      kind: request.kind,
      status: "queued",
      note: request.note,
      count: request.kind === "variants" ? Math.min(Math.max(request.count ?? 3, 1), 6) : 1,
      variantId: request.target.variantId,
      target: request.target,
      provider: this.provider.name,
      createdAt: now,
      updatedAt: now,
      producedFiles: [],
      log: [],
    }
    this.state.jobs.push(job)
    this.bump()
    void this.run(job, request)
    return job
  }

  private async enrich(job: Job, request: ChangeRequest) {
    job.attachments = (request.attachments ?? []).map((id) => readUpload(this.config, id)).filter((u): u is NonNullable<typeof u> => Boolean(u))
    const target = request.target
    if (!this.renderer || !target.storyId || !target.region) return
    const variants = target.variantKeys ?? {}
    const viewport = target.viewport?.width ? { width: target.viewport.width, height: target.viewport.height } : {}
    try {
      const description = await this.renderer.describe(target.storyId, target.region, { variants, ...viewport })
      if (!target.components?.length) target.components = description.components
      if (!target.selector) target.selector = description.selector ?? ""
      if (!target.text) target.text = description.text
      if (!target.variantId && description.variantIds.length === 1) target.variantId = description.variantIds[0]
      if (!job.variantId) job.variantId = target.variantId
      if (description.variantIds.length) this.log(job, `Variant boundaries in selection: ${description.variantIds.join(", ")}`)
    } catch (e) {
      this.log(job, `Could not describe selection: ${(e as Error).message.slice(0, 160)}`)
    }
    try {
      const pad = 24
      const r = target.region
      const png = await this.renderer.shot(target.storyId, {
        variants,
        ...viewport,
        region: { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.width + pad * 2, height: r.height + pad * 2 },
      })
      const upload = writeUpload(this.config, png, "image/png", `selection-${job.id}.png`)
      job.selectionImage = upload.path
    } catch (e) {
      this.log(job, `Could not capture selection: ${(e as Error).message.slice(0, 160)}`)
    }
    this.bump()
  }

  private async run(job: Job, request: ChangeRequest) {
    await this.enrich(job, request)
    const prompt = buildPrompt(this.config, job, request)
    fs.writeFileSync(path.join(this.config.stateDir, `prompt-${job.id}.md`), prompt)
    try {
      job.status = "running"
      this.bump()
      const run = await this.provider.start(job, prompt, { cwd: this.agentCwd, log: (l) => this.log(job, l), mcp: this.mcpLaunch() })
      this.runs.set(job.id, run)
      job.externalId = run.externalId
      job.externalUrl = run.externalUrl
      this.bump()
      const reported = new Promise<{ ok: boolean; error?: string }>((resolve) => this.completions.set(job.id, resolve))
      const result = await Promise.race([run.done, reported])
      run.detach?.()
      if ((job.status as Job["status"]) === "cancelled") return
      await this.refreshVariants()
      job.status = result.ok ? "done" : "failed"
      job.error = result.error
    } catch (e) {
      job.status = "failed"
      job.error = (e as Error).message
    } finally {
      this.runs.delete(job.id)
      this.completions.delete(job.id)
      job.updatedAt = new Date().toISOString()
      this.bump()
    }
  }

  complete(id: string, report: { summary?: string; failed?: boolean }): Job | undefined {
    const job = this.state.jobs.find((j) => j.id === id)
    if (!job) return undefined
    if (report.summary) job.summary = report.summary.slice(0, 2000)
    const resolve = this.completions.get(id)
    if (resolve) resolve(report.failed ? { ok: false, error: report.summary || "the agent reported a failure" } : { ok: true })
    else this.bump()
    return job
  }

  cancel(id: string) {
    const job = this.state.jobs.find((j) => j.id === id)
    if (!job) return
    job.status = "cancelled"
    this.runs.get(id)?.cancel()
    this.bump()
  }

  async handle(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    const send = (status: number, body: unknown) => {
      res.statusCode = status
      res.setHeader("content-type", "application/json")
      res.setHeader("cache-control", "no-store")
      res.end(JSON.stringify(body))
    }
    try {
      if (req.method === "GET" && pathname === "/state") {
        send(200, this.state)
        return true
      }
      if (req.method === "GET" && pathname === "/events") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" })
        const push = () => res.write(`data: ${JSON.stringify(this.state)}\n\n`)
        push()
        const off = this.onChange(push)
        req.on("close", () => off())
        return true
      }
      if (req.method === "POST" && pathname === "/select") {
        const body = await readJson(req)
        this.select(String(body.id), String(body.key))
        send(200, { ok: true })
        return true
      }
      if (req.method === "POST" && pathname === "/requests") {
        const body = (await readJson(req)) as ChangeRequest
        if (!body?.note || !body?.target) return send(400, { error: "note and target are required" }), true
        send(200, await this.createJob(body))
        return true
      }
      const cancel = /^\/jobs\/([\w-]+)\/cancel$/.exec(pathname)
      if (req.method === "POST" && cancel) {
        this.cancel(cancel[1])
        send(200, { ok: true })
        return true
      }
      const complete = /^\/jobs\/([\w-]+)\/complete$/.exec(pathname)
      if (req.method === "POST" && complete) {
        const body = await readJson(req)
        const job = this.complete(complete[1], { summary: body.summary ? String(body.summary) : undefined, failed: Boolean(body.failed) })
        if (!job) return send(404, { error: `no job ${complete[1]}` }), true
        send(200, { ok: true, status: job.status })
        return true
      }
      const prompt = /^\/jobs\/([\w-]+)\/prompt$/.exec(pathname)
      if (req.method === "GET" && prompt) {
        const file = path.join(this.config.stateDir, `prompt-${prompt[1]}.md`)
        res.setHeader("content-type", "text/plain; charset=utf-8")
        res.end(fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "")
        return true
      }
    } catch (e) {
      send(500, { error: (e as Error).message })
      return true
    }
    return false
  }
}

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = ""
    req.on("data", (c) => (data += c))
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on("error", reject)
  })
}
