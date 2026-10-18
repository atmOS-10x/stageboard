import { createHash } from "node:crypto"
import fs from "node:fs"
import type { ServerResponse } from "node:http"
import path from "node:path"
import type { Browser, Page } from "playwright-core"
import { API_BASE, type BridgeState, type Region, type RegionDescription, type Sketch } from "../core/protocol"
import type { ResolvedConfig } from "./config"
import { settle } from "./settle"
import { launchBrowser } from "./shot"

type Job = () => Promise<void>

export type RenderOptions = {
  variants?: Record<string, string>
  width?: number
  height?: number
  scale?: number
  useSelections?: boolean
}

export type ShotRequest = RenderOptions & {
  full?: boolean
  region?: Region
  format?: "png" | "jpeg"
  sketch?: Sketch
}

const CONCURRENCY = 2
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

  usedVariants(id: string): string[] | undefined {
    return this.used[id]
  }

  private effectiveVariants(options: RenderOptions): Record<string, string> {
    const fromSelections = options.useSelections === false ? {} : this.state().selections
    return { ...fromSelections, ...(options.variants ?? {}) }
  }

  private cacheKey(id: string, storyFile: string | undefined, variants: Record<string, string>): string {
    const state = this.state()
    const used = this.used[id]
    const relevant = used ? Object.fromEntries(used.map((v) => [v, variants[v] ?? "original"])) : variants
    const files = used ? state.variants.filter((v) => used.includes(v.of)) : state.variants
    const mtimes = [storyFile, this.config.variantsFile, ...files.map((v) => path.join(this.config.root, v.file))]
      .filter((f): f is string => Boolean(f))
      .map((f) => {
        try {
          return fs.statSync(f).mtimeMs
        } catch {
          return 0
        }
      })
    return createHash("sha1").update(JSON.stringify([relevant, mtimes])).digest("hex").slice(0, 12)
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) {
      const existing = await this.browser.catch(() => undefined)
      if (existing?.isConnected()) return existing
      this.browser = undefined
    }
    const launching = launchBrowser()
    this.browser = launching
    const browser = await launching
    browser.on("disconnected", () => {
      if (this.browser === launching) this.browser = undefined
    })
    return browser
  }

  private scheduleIdleClose() {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(async () => {
      if (this.active || this.queue.length || !this.browser) return
      const browser = await this.browser.catch(() => undefined)
      this.browser = undefined
      await browser?.close().catch(() => {})
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

  private schedule<T>(fn: () => Promise<T>, priority = false): Promise<T> {
    return new Promise((resolve, reject) => {
      const job: Job = () => fn().then(resolve, reject)
      if (priority) this.queue.unshift(job)
      else this.queue.push(job)
      this.pump()
    })
  }

  private async openStory(id: string, options: RenderOptions, attempt = 0): Promise<Page> {
    const browser = await this.getBrowser()
    let page: Page | undefined
    try {
      page = await browser.newPage({
        viewport: { width: options.width ?? 1440, height: options.height ?? 900 },
        deviceScaleFactor: options.scale ?? 1,
        reducedMotion: "reduce",
      })
      const params = new URLSearchParams({ story: id, "sb-shot": "1" })
      for (const [vid, key] of Object.entries(this.effectiveVariants(options))) {
        if (key && key !== "original") params.append("sb-variant", `${vid}:${key}`)
      }
      await page.goto(`${this.baseUrl()}${API_BASE}/frame.html?${params}`, { waitUntil: "load", timeout: 60_000 })
      await page
        .waitForFunction(() => (window as any).__STAGEBOARD_READY__ === true || (window as any).__STAGEBOARD_ERROR__, undefined, {
          timeout: 45_000,
        })
        .catch(() => {})
      await settle(page)
      const usedIds = await page.evaluate(() => Array.from(((globalThis as any).__STAGEBOARD_USED__ as Set<string>) ?? []))
      this.used[id] = usedIds.sort()
      fs.writeFileSync(this.usedFile, JSON.stringify(this.used))
      return page
    } catch (e) {
      await page?.close().catch(() => {})
      if (attempt === 0 && (!browser.isConnected() || /Target|closed|crash/i.test((e as Error).message))) {
        this.browser = undefined
        return this.openStory(id, options, 1)
      }
      throw e
    }
  }

  private renderThumb(id: string, file: string, variants: Record<string, string>): Promise<string> {
    return this.schedule(async () => {
      let page: Page | undefined
      try {
        page = await this.openStory(id, { variants, scale: 0.5, useSelections: false })
        await page.screenshot({ path: file, type: "jpeg", quality: 72 })
        return file
      } catch (e) {
        console.warn(`[stageboard] thumbnail ${id} failed: ${(e as Error).message}`)
        throw e
      } finally {
        await page?.close().catch(() => {})
      }
    })
  }

  private ensure(id: string, storyFile: string | undefined, extra: Record<string, string> = {}, refresh = false): Promise<string> {
    const variants = this.effectiveVariants({ variants: extra })
    const key = this.cacheKey(id, storyFile, variants)
    const file = path.join(this.dir, `${id.replace(/[^\w.-]/g, "_")}.${key}.jpg`)
    if (!refresh && fs.existsSync(file)) return Promise.resolve(file)
    let pending = this.inflight.get(file)
    if (!pending) {
      pending = this.renderThumb(id, file, variants).finally(() => this.inflight.delete(file))
      this.inflight.set(file, pending)
    }
    return pending
  }

  warm(stories: { id: string; absFile: string }[]) {
    for (const s of stories) this.ensure(s.id, s.absFile).catch(() => {})
  }

  async serve(res: ServerResponse, id: string, storyFile: string | undefined, refresh: boolean, variants: Record<string, string> = {}) {
    try {
      const file = await this.ensure(id, storyFile, variants, refresh)
      res.setHeader("content-type", "image/jpeg")
      res.setHeader("cache-control", "no-cache")
      fs.createReadStream(file).pipe(res)
    } catch (e) {
      res.statusCode = 500
      res.end((e as Error).message)
    }
  }

  shot(id: string, request: ShotRequest): Promise<Buffer> {
    return this.schedule(async () => {
      const page = await this.openStory(id, request)
      try {
        if (request.sketch) {
          await page.evaluate((ops) => (window as any).__stageboard_sketch?.apply(ops), request.sketch.ops)
          await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLIFrameElement>("#__sb-sketch iframe")).every((f) => (f.contentWindow as any)?.__STAGEBOARD_READY__), undefined, { timeout: 20_000 }).catch(() => {})
          await settle(page)
        }
        const type = request.format ?? "png"
        if (request.region) {
          const r = request.region
          const vp = page.viewportSize() ?? { width: 1440, height: 900 }
          const needed = Math.ceil(r.y + r.height)
          if (needed > vp.height) await page.setViewportSize({ width: vp.width, height: needed })
          return await page.screenshot({
            type,
            clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.max(1, r.width), height: Math.max(1, r.height) },
          })
        }
        return await page.screenshot({ type, fullPage: Boolean(request.full) })
      } finally {
        await page.close().catch(() => {})
      }
    }, true)
  }

  describe(id: string, region: Region, options: RenderOptions = {}): Promise<RegionDescription> {
    return this.schedule(async () => {
      const page = await this.openStory(id, options)
      try {
        const vp = page.viewportSize() ?? { width: 1440, height: 900 }
        const needed = Math.ceil(region.y + region.height)
        if (needed > vp.height) await page.setViewportSize({ width: vp.width, height: needed })
        return await page.evaluate((r) => {
          const fn = (window as any).__stageboard_describeRegion as ((rect: unknown) => unknown) | undefined
          return (fn ? fn(r) : { components: [], variantIds: [] }) as RegionDescription
        }, region)
      } finally {
        await page.close().catch(() => {})
      }
    }, true)
  }
}

export function parseVariantParam(value: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pair of (value ?? "").split(",")) {
    const [id, key] = pair.split(":")
    if (id && key) out[id] = key
  }
  return out
}
