import { execSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"
import type { BridgeState, ChangeRequest, Dream, DreamRequest, Flow, FlowRequest, FlowStep, Job, VariantFile } from "../core/protocol"
import { createRequire } from "node:module"
import { createProvider, type AgentProvider, type AgentRun, type McpLaunch } from "./agents"
import type { ResolvedConfig } from "./config"
import { buildIndex } from "./indexer"
import { buildPrompt } from "./prompt"
import type { Thumbnailer } from "./thumbs"
import { readUpload, writeUpload } from "./uploads"
import { scanVariants, writeVariantsModule } from "./variants"

type Persisted = { selections: Record<string, string>; jobs: Job[] }
type Board = { dreams: Dream[]; flows: Flow[] }

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
  private boardFile: string
  private rescanTimer?: ReturnType<typeof setTimeout>
  private listeners = new Set<() => void>()
  private renderer?: Thumbnailer
  flowIndex: { id: string; title: string; file: string }[] = []
  readonly agentCwd: string

  constructor(private config: ResolvedConfig) {
    fs.mkdirSync(config.stateDir, { recursive: true })
    this.stateFile = path.join(config.stateDir, "state.json")
    const persisted = this.load()
    this.boardFile = path.join(config.root, "stageboard", "board.json")
    const board = this.loadBoard()
    this.state = { version: 1, selections: persisted.selections, jobs: persisted.jobs, variants: [], dreams: board.dreams, flows: board.flows }
    this.provider = createProvider(config.agent)
    this.agentCwd = gitRoot(config.root)
    for (const job of this.state.jobs) {
      if (job.status === "running" || job.status === "queued") {
        job.status = "failed"
        job.error = "stageboard restarted while the agent was running"
      }
    }
    for (const flow of this.state.flows) {
      if (flow.status === "assembling" && !this.state.jobs.some((j) => j.id === flow.jobId && (j.status === "running" || j.status === "queued"))) flow.status = "failed"
    }
    for (const dream of this.state.dreams) {
      if (dream.status === "rendering" && !this.state.jobs.some((j) => j.id === dream.jobId && (j.status === "running" || j.status === "queued"))) dream.status = "failed"
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

  private loadBoard(): Board {
    try {
      const raw = JSON.parse(fs.readFileSync(this.boardFile, "utf8"))
      return { dreams: raw.dreams ?? [], flows: raw.flows ?? [] }
    } catch {
      return { dreams: [], flows: [] }
    }
  }

  private saveBoard() {
    fs.mkdirSync(path.dirname(this.boardFile), { recursive: true })
    const board: Board = { dreams: this.state.dreams, flows: this.state.flows }
    fs.writeFileSync(this.boardFile, JSON.stringify(board, null, 2) + "\n")
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
      ...(request.dream ? { dream: request.dream.id } : {}),
      ...(request.flow ? { flow: request.flow.id } : {}),
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
    if (request.kind === "page") return this.enrichPage(job, request)
    if (request.kind === "flow" || request.flow) {
      this.flowIndex = (await buildIndex(this.config)).filter((s) => s.hasPage).map((s) => ({ id: s.id, title: `${s.title} / ${s.name}`, file: s.file }))
      if (request.kind === "flow" || !request.target.region) return
    }
    if (request.sketch) return this.enrichSketch(job, request)
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

  private async enrichPage(job: Job, request: ChangeRequest) {
    const parent = request.target.storyId
    if (!this.renderer || !parent) return
    try {
      const png = await this.renderer.shot(parent, { width: 1440, height: 900 })
      job.selectionImage = writeUpload(this.config, png, "image/png", `parent-${job.id}.png`).path
    } catch (e) {
      this.log(job, `Could not capture the parent page: ${(e as Error).message.slice(0, 160)}`)
    }
    this.bump()
  }

  private async enrichSketch(job: Job, request: ChangeRequest) {
    const { target, sketch } = request
    if (!this.renderer || !target.storyId || !sketch) return
    const { viewport, scroll } = sketch
    const region = { x: scroll.x, y: scroll.y, width: viewport.width, height: viewport.height }
    const base = { variants: target.variantKeys ?? {}, width: viewport.width, height: viewport.height, region }
    try {
      job.selectionImage = writeUpload(this.config, await this.renderer.shot(target.storyId, base), "image/png", `before-${job.id}.png`).path
      job.sketchImage = writeUpload(this.config, await this.renderer.shot(target.storyId, { ...base, sketch }), "image/png", `sketch-${job.id}.png`).path
    } catch (e) {
      this.log(job, `Could not render the sketch: ${(e as Error).message.slice(0, 160)}`)
    }
    this.bump()
  }

  private settleFlow(id: string, ok: boolean) {
    const flow = this.state.flows.find((f) => f.id === id)
    if (!flow || flow.status !== "assembling") return
    flow.status = ok ? "ready" : "failed"
    this.saveBoard()
  }

  private async settleDream(job: Job, ok: boolean) {
    const dream = this.state.dreams.find((d) => d.id === job.dream)
    if (!dream) return
    const story = (await buildIndex(this.config)).find((s) => s.dream === dream.id)
    if (story) dream.storyId = story.id
    dream.status = ok && story ? "done" : "failed"
    if (story) for (const flow of this.state.flows) for (const step of flow.steps) if (step.dream === dream.id) step.storyId = story.id
    if (ok && !story) this.log(job, `The agent finished but no story declares page.dream "${dream.id}"`)
    this.saveBoard()
  }

  async createDream(input: DreamRequest): Promise<Dream> {
    const dream: Dream = {
      id: randomUUID().slice(0, 8),
      name: input.name?.trim() || undefined,
      prompt: input.prompt.trim(),
      parent: input.parent,
      position: input.position,
      status: "rendering",
      createdAt: new Date().toISOString(),
    }
    this.state.dreams.push(dream)
    const flow = input.flow && this.state.flows.find((f) => f.id === input.flow!.id)
    if (flow) flow.steps.splice(Math.max(0, Math.min(flow.steps.length, input.flow!.index)), 0, { id: randomUUID().slice(0, 8), dream: dream.id })
    await this.startDream(dream, input.parentUrl, input.attachments)
    return dream
  }

  private async startDream(dream: Dream, parentUrl?: string, attachments?: string[]) {
    dream.status = "rendering"
    dream.storyId = undefined
    const job = await this.createJob({
      kind: "page",
      note: dream.name ? `${dream.name}: ${dream.prompt}` : dream.prompt,
      dream,
      attachments,
      target: {
        url: parentUrl ?? "",
        selector: "",
        tag: "page",
        rect: { x: 0, y: 0, width: 1440, height: 900 },
        viewport: { width: 1440, height: 900 },
        components: [],
        storyId: dream.parent,
      },
    })
    dream.jobId = job.id
    this.saveBoard()
    this.bump()
  }

  updateDream(id: string, patch: { position?: { x: number; y: number }; retry?: boolean }) {
    const dream = this.state.dreams.find((d) => d.id === id)
    if (!dream) return undefined
    if (patch.position) dream.position = patch.position
    if (patch.retry && dream.status === "failed") void this.startDream(dream)
    this.saveBoard()
    this.bump()
    return dream
  }

  async createFlow(input: FlowRequest): Promise<Flow | undefined> {
    if (input.suggest) {
      await this.createJob({ kind: "flow", note: input.description?.trim() || "Suggest the main user flows of this app.", target: emptyTarget() })
      return undefined
    }
    const flow: Flow = {
      id: randomUUID().slice(0, 8),
      name: input.name?.trim() || input.description?.trim().slice(0, 60) || "New flow",
      description: input.description?.trim() || undefined,
      group: input.group?.trim() || undefined,
      steps: (input.steps ?? []).map((s) => ({ ...s, id: s.id || randomUUID().slice(0, 8) })),
      status: "ready",
      createdAt: new Date().toISOString(),
    }
    this.state.flows.push(flow)
    if (input.assemble && flow.description) {
      flow.status = "assembling"
      const job = await this.createJob({ kind: "flow", note: flow.description, flow, target: emptyTarget(), attachments: input.attachments })
      flow.jobId = job.id
    }
    this.saveBoard()
    this.bump()
    return flow
  }

  updateFlow(id: string, patch: Partial<Pick<Flow, "name" | "description" | "group" | "steps">> & { retry?: boolean }): Flow | undefined {
    const flow = this.state.flows.find((f) => f.id === id)
    if (!flow) return undefined
    if (patch.retry && flow.description && flow.status !== "assembling") {
      flow.status = "assembling"
      void this.createJob({ kind: "flow", note: flow.description, flow, target: emptyTarget() }).then((job) => {
        flow.jobId = job.id
        this.saveBoard()
      })
    }
    if (patch.name !== undefined) flow.name = patch.name.trim() || flow.name
    if (patch.description !== undefined) flow.description = patch.description.trim() || undefined
    if (patch.group !== undefined) flow.group = patch.group.trim() || undefined
    if (patch.steps) flow.steps = patch.steps.map((s) => ({ ...s, id: s.id || randomUUID().slice(0, 8) }))
    this.saveBoard()
    this.bump()
    return flow
  }

  removeFlow(id: string) {
    const flow = this.state.flows.find((f) => f.id === id)
    if (flow?.jobId && this.runs.has(flow.jobId)) this.cancel(flow.jobId)
    this.state.flows = this.state.flows.filter((f) => f.id !== id)
    this.saveBoard()
    this.bump()
  }

  // An agent saves a flow it assembled: it updates the flow it was given, or adds a new one.
  saveFlowFromAgent(input: { flow?: string; name?: string; description?: string; group?: string; steps: Omit<FlowStep, "id">[] }): Flow {
    const steps = input.steps.map((s) => ({ ...s, id: randomUUID().slice(0, 8) }))
    const existing = input.flow ? this.state.flows.find((f) => f.id === input.flow) : undefined
    if (existing) {
      this.updateFlow(existing.id, { name: input.name, description: input.description, group: input.group, steps })
      return existing
    }
    const flow: Flow = {
      id: randomUUID().slice(0, 8),
      name: input.name?.trim() || "Untitled flow",
      description: input.description,
      group: input.group,
      steps,
      status: "ready",
      createdAt: new Date().toISOString(),
    }
    this.state.flows.push(flow)
    this.saveBoard()
    this.bump()
    return flow
  }

  removeDream(id: string) {
    const dream = this.state.dreams.find((d) => d.id === id)
    if (!dream) return
    if (dream.jobId && this.runs.has(dream.jobId)) this.cancel(dream.jobId)
    this.state.dreams = this.state.dreams.filter((d) => d.id !== id)
    this.saveBoard()
    this.bump()
  }

  private async run(job: Job, request: ChangeRequest) {
    await this.enrich(job, request)
    const prompt = buildPrompt(this.config, job, request, this.flowIndex)
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
      job.error = result.ok ? undefined : explainFailure(job, result.error)
      if (job.dream) await this.settleDream(job, result.ok)
      if (job.flow) this.settleFlow(job.flow, result.ok)
    } catch (e) {
      job.status = "failed"
      job.error = (e as Error).message
      if (job.dream) await this.settleDream(job, false)
      if (job.flow) this.settleFlow(job.flow, false)
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
    const flow = this.state.flows.find((f) => f.jobId === id && f.status === "assembling")
    if (flow) flow.status = "failed"
    const dream = this.state.dreams.find((d) => d.jobId === id && d.status === "rendering")
    if (dream) {
      dream.status = "failed"
      this.saveBoard()
    }
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
      if (req.method === "POST" && pathname === "/flows") {
        const flow = await this.createFlow((await readJson(req)) as FlowRequest)
        send(200, flow ?? { ok: true })
        return true
      }
      if (req.method === "POST" && pathname === "/flows/save") {
        const body = await readJson(req)
        if (!Array.isArray(body?.steps)) return send(400, { error: "steps are required" }), true
        send(200, this.saveFlowFromAgent(body))
        return true
      }
      const flowRoute = /^\/flows\/([\w-]+)(\/remove)?$/.exec(pathname)
      if (req.method === "POST" && flowRoute) {
        if (flowRoute[2]) {
          this.removeFlow(flowRoute[1])
          send(200, { ok: true })
          return true
        }
        const flow = this.updateFlow(flowRoute[1], await readJson(req))
        if (!flow) return send(404, { error: `no flow ${flowRoute[1]}` }), true
        send(200, flow)
        return true
      }
      if (req.method === "POST" && pathname === "/dreams") {
        const body = (await readJson(req)) as DreamRequest
        if (!body?.prompt?.trim()) return send(400, { error: "prompt is required" }), true
        send(200, await this.createDream(body))
        return true
      }
      const dreamRoute = /^\/dreams\/([\w-]+)(\/remove)?$/.exec(pathname)
      if (req.method === "POST" && dreamRoute) {
        if (dreamRoute[2]) {
          this.removeDream(dreamRoute[1])
          send(200, { ok: true })
          return true
        }
        const dream = this.updateDream(dreamRoute[1], await readJson(req))
        if (!dream) return send(404, { error: `no dream ${dreamRoute[1]}` }), true
        send(200, dream)
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

// "exit code 1" says little; the agent's own error line usually says what to fix.
function explainFailure(job: Job, error?: string): string | undefined {
  const line = [...job.log].reverse().find((l) => /\b(error|failed|refused|denied|not found|unauthori[sz]ed|forbidden)\b/i.test(l) && !/^\s*at\s/.test(l))
  if (!line) return error
  const cleaned = line.replace(/^\s*(Uncaught\s+)?Error:\s*/i, "").trim()
  return error && !cleaned.includes(error) ? `${cleaned} (${error})` : cleaned
}

function emptyTarget(): ChangeRequest["target"] {
  return { url: "", selector: "", tag: "flow", rect: { x: 0, y: 0, width: 0, height: 0 }, viewport: { width: 1440, height: 900 }, components: [] }
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
