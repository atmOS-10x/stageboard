import { createHash } from "node:crypto"
import fs from "node:fs"
import type { ServerResponse } from "node:http"
import path from "node:path"
import type { Browser } from "playwright-core"
import { API_BASE, type BridgeState } from "../core/protocol"
import type { ResolvedConfig } from "./config"
import { launchBrowser } from "./shot"

type Job = () => Promise<void>

const CONCURRENCY = 3
const IDLE_CLOSE_MS = 120_000

export class Thumbnailer {
  private browser?: Promise<Browser>
  private queue: Job[] = []
  private active = 0
  private inflight = new Map<string, Promise<string>>()
  private idleTimer?: ReturnType<typeof setTimeout>
  private dir: string
  private usedFile: string
  private used: Record<string, string[]>

  constructor(
    private config: ResolvedConfig,
    private baseUrl: () => string,
    private state: () => BridgeState,
  ) {
    this.dir = path.join(config.stateDir, "thumbs")
    fs.mkdirSync(this.dir, { recursive: true })
    this.usedFile = path.join(this.dir, "used-variants.json")
    try {
      this.used = JSON.parse(fs.readFileSync(this.usedFile, "utf8"))
    } catch {
      this.used = {}
    }
  }

  private cacheKey(id: string, storyFile: string | undefined): string {
    const state = this.state()
    const used = this.used[id]
    const selections = used ? Object.fromEntries(used.map((v) => [v, state.selections[v] ?? "original"])) : state.selections
    const variants = used ? state.variants.filter((v) => used.includes(v.of)) : state.variants
    const mtimes = [storyFile, this.config.variantsFile, ...variants.map((v) => path.join(this.config.root, v.file))]
      .filter((f): f is string => Boolean(f))
      .map((f) => {
        try {
          return fs.statSync(f).mtimeMs
        } catch {
          return 0
        }
      })
    return createHash("sha1").update(JSON.stringify([selections, mtimes])).digest("hex").slice(0, 12)
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) this.browser = launchBrowser()
    return this.browser
  }

  private scheduleIdleClose() {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(async () => {
      if (this.active || this.queue.length || !this.browser) return
      const b = await this.browser
      this.browser = undefined
      await b.close().catch(() => {})
    }, IDLE_CLOSE_MS)
  }

  private pump() {
    while (this.active < CONCURRENCY && this.queue.length) {
      const job = this.queue.shift()!
      this.active++
      job().finally(() => {
        this.active--
        this.scheduleIdleClose()
        this.pump()
      })
    }
  }

  private render(id: string, file: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const browser = await this.getBrowser()
          const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 0.5 })
          try {
            const params = new URLSearchParams({ story: id, "sb-shot": "1" })
            for (const [vid, key] of Object.entries(this.state().selections)) {
              if (key && key !== "original") params.append("sb-variant", `${vid}:${key}`)
            }
            await page.goto(`${this.baseUrl()}${API_BASE}/frame.html?${params}`, { waitUntil: "load", timeout: 60_000 })
            await page
              .waitForFunction(() => (window as any).__STAGEBOARD_READY__ === true || (window as any).__STAGEBOARD_ERROR__, undefined, { timeout: 45_000 })
              .catch(() => {})
            await page.screenshot({ path: file, type: "jpeg", quality: 72 })
            const usedIds = await page.evaluate(() => Array.from(((globalThis as any).__STAGEBOARD_USED__ as Set<string>) ?? []))
            this.used[id] = usedIds.sort()
            fs.writeFileSync(this.usedFile, JSON.stringify(this.used))
            resolve(file)
          } finally {
            await page.close().catch(() => {})
          }
        } catch (e) {
          reject(e)
        }
      })
      this.pump()
    })
  }

  private ensure(id: string, storyFile: string | undefined, refresh = false): Promise<string> {
    const key = this.cacheKey(id, storyFile)
    const file = path.join(this.dir, `${id.replace(/[^\w.-]/g, "_")}.${key}.jpg`)
    if (!refresh && fs.existsSync(file)) return Promise.resolve(file)
    let pending = this.inflight.get(file)
    if (!pending) {
      pending = this.render(id, file).finally(() => this.inflight.delete(file))
      this.inflight.set(file, pending)
    }
    return pending
  }

  warm(stories: { id: string; absFile: string }[]) {
    for (const s of stories) this.ensure(s.id, s.absFile).catch(() => {})
  }

  async serve(res: ServerResponse, id: string, storyFile: string | undefined, refresh: boolean) {
    try {
      const file = await this.ensure(id, storyFile, refresh)
      res.setHeader("content-type", "image/jpeg")
      res.setHeader("cache-control", "no-cache")
      fs.createReadStream(file).pipe(res)
    } catch (e) {
      res.statusCode = 500
      res.end((e as Error).message)
    }
  }
}
