import fs from "node:fs"
import path from "node:path"
import { API_BASE } from "../core/protocol"
import type { ResolvedConfig } from "./config"
import { buildIndex, metaObject, objectAt, topLevel, type IndexedStory } from "./indexer"
import { createStageboardServer, findRunningServer } from "./server"
import { launchBrowser } from "./shot"

// `stageboard frames`: give every component story a frame (`parameters.viewport`) that fits what it draws, so it
// shows as large as it can in its 16:9 tile instead of small in a page-sized viewport.

export type Frame = { width: number; height: number }
export type Need = { width: number; height: number; overlay: boolean; fluid?: boolean }

// The centered layout pads 32px each side; a little more keeps the content off the frame's edge.
const PAD = 40
const MIN: Frame = { width: 120, height: 68 }
// Things that open a menu, popover or dialog from a trigger need room for it once it opens in the viewer.
const OPENS = /(menu|popover|dialog|combobox|picker|select|tooltip|hover-card|date|sheet|command|drawer)/i
// A story much smaller than its file's frame gets its own, or it looks lost in its tile.
const OWN_FRAME_BELOW = 0.35

const up = (n: number, step: number) => Math.ceil(n / step) * step

export function frameFor(need: Need, file: string): Frame {
  const pad = need.overlay ? PAD * 2 : PAD
  let width = Math.max(MIN.width, up(need.width + pad * 2, 10))
  let height = Math.max(MIN.height, up(need.height + pad * 2, 10))
  if (OPENS.test(path.basename(file))) {
    width = Math.max(width, need.overlay ? 640 : 480)
    height = Math.max(height, need.overlay ? 400 : 320)
  }
  return { width, height }
}

export type FilePlan = { file: string; meta: Frame; stories: { exportName: string; frame: Frame }[] }

/** One frame per file that fits all its stories, plus a frame of their own for stories much smaller than it. */
export function planFrames(stories: { exportName: string; file: string; frame: Frame }[]): FilePlan[] {
  const byFile = new Map<string, typeof stories>()
  for (const s of stories) byFile.set(s.file, [...(byFile.get(s.file) ?? []), s])
  return [...byFile].map(([file, list]) => {
    const meta = { width: Math.max(...list.map((s) => s.frame.width)), height: Math.max(...list.map((s) => s.frame.height)) }
    const own = list.filter((s) => s.frame.width * s.frame.height < OWN_FRAME_BELOW * meta.width * meta.height)
    return { file, meta, stories: own.map((s) => ({ exportName: s.exportName, frame: s.frame })) }
  })
}

type Edit = { at: number; text: string }

const literal = (f: Frame) => `viewport: { width: ${f.width}, height: ${f.height} }`

// Put the viewport into the object starting at `start`: into its parameters object, or as a new last key.
function viewportEdits(source: string, start: number, frame: Frame): Edit[] | string {
  const body = objectAt(source, start)
  if (!body) return "not an object"
  const own = topLevel(body)
  const p = /\bparameters\s*:/.exec(own)
  if (p) {
    const rest = body.slice(p.index + p[0].length)
    const at = p.index + p[0].length + (rest.length - rest.trimStart().length)
    const params = objectAt(body, at)
    if (!params) return "its parameters are not an object literal"
    if (/\bviewport\s*:/.test(topLevel(params))) return "already has a viewport"
    const inner = params.slice(1, -1)
    return [{ at: start + at + 1, text: inner.trim() ? ` ${literal(frame)},` : ` ${literal(frame)} ` }]
  }
  const inner = body.slice(1, -1)
  if (!inner.trim()) return [{ at: start + 1, text: ` parameters: { ${literal(frame)} } ` }]
  if (!inner.startsWith("\n")) {
    const last = inner.trimEnd()
    return [{ at: start + 1 + last.length, text: `${last.endsWith(",") ? "" : ","} parameters: { ${literal(frame)} }` }]
  }
  // Last, after the other keys, as the file writes them.
  const indent = /^\n([ \t]*)/.exec(inner)?.[1] ?? "  "
  const lastLine = start + body.lastIndexOf("\n")
  const before = source.slice(start, lastLine).trimEnd()
  const key = `\n${indent}parameters: { ${literal(frame)} },`
  if (before.endsWith(",")) return [{ at: lastLine, text: key }]
  const commaAt = start + before.length
  return commaAt === lastLine ? [{ at: lastLine, text: `,${key}` }] : [{ at: commaAt, text: "," }, { at: lastLine, text: key }]
}

/** The story file with the plan's frames written in; what it left alone and why. */
export function writeFrames(source: string, plan: FilePlan): { source: string; skipped: string[] } {
  const edits: Edit[] = []
  const skipped: string[] = []
  const meta = metaObject(source)
  const metaAt = meta ? source.indexOf(meta) : -1
  const m = metaAt >= 0 ? viewportEdits(source, metaAt, plan.meta) : "no meta object"
  if (typeof m === "string") skipped.push(`meta: ${m}`)
  else edits.push(...m)
  for (const s of plan.stories) {
    const decl = new RegExp(`export\\s+const\\s+${s.exportName.replace(/\$/g, "\\$")}\\b[^=]*=\\s*`).exec(source)
    const e = decl ? viewportEdits(source, decl.index + decl[0].length, s.frame) : "not found"
    if (typeof e === "string") skipped.push(`${s.exportName}: ${e}`)
    else edits.push(...e)
  }
  let out = source
  for (const e of edits.sort((a, b) => b.at - a.at)) out = out.slice(0, e.at) + e.text + out.slice(e.at)
  return { source: out, skipped }
}

// Runs in the page: the union of everything visible, clipped by its scrolling or hidden ancestors, leaving out
// wrappers and overlays as wide as the page. `overlay` says a dialog or sheet covers it.
function measurePage() {
  const vw = innerWidth
  const vh = innerHeight
  let overlay = false
  const box = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity }
  type Clip = { l: number; t: number; r: number; b: number }
  const clips = new Map<Element, Clip>()
  const clipOf = (el: Element | null): Clip => {
    if (!el || el === document.body || el === document.documentElement) return { l: -Infinity, t: -Infinity, r: Infinity, b: Infinity }
    const known = clips.get(el)
    if (known) return known
    const parent = clipOf(el.parentElement)
    const cs = getComputedStyle(el)
    let c = parent
    if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
      const r = el.getBoundingClientRect()
      c = { l: Math.max(parent.l, r.left), t: Math.max(parent.t, r.top), r: Math.min(parent.r, r.right), b: Math.min(parent.b, r.bottom) }
    }
    clips.set(el, c)
    return c
  }
  for (const el of document.querySelectorAll("body *")) {
    if (/^(SCRIPT|STYLE|LINK|META|TEMPLATE)$/.test(el.tagName)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === "hidden" || cs.display === "contents" || Number(cs.opacity) === 0) continue
    if (r.width >= vw * 0.98) {
      if (r.height >= vh * 0.98 && cs.position === "fixed") overlay = true
      continue
    }
    const c = clipOf(el.parentElement)
    const l = Math.max(r.left, c.l)
    const t = Math.max(r.top, c.t)
    const right = Math.min(r.right, c.r)
    const bottom = Math.min(r.bottom, c.b)
    if (right - l < 1 || bottom - t < 1) continue
    box.l = Math.min(box.l, l)
    box.t = Math.min(box.t, t)
    box.r = Math.max(box.r, right)
    box.b = Math.max(box.b, bottom)
  }
  const doc = document.documentElement
  return {
    width: box.l === Infinity ? 0 : Math.ceil(box.r - box.l),
    height: box.l === Infinity ? 0 : Math.ceil(box.b - box.t),
    overlay,
    scrollWidth: doc.scrollWidth,
    scrollHeight: doc.scrollHeight,
  }
}

export type FramesOptions = { filter?: string; write?: boolean; concurrency?: number; onProgress?: (done: number, total: number) => void }

export type FramesResult = {
  stories: { id: string; file: string; exportName: string; need?: Need; frame?: Frame; page?: boolean; error?: string }[]
  plans: FilePlan[]
  written: string[]
  skipped: string[]
}

/** Measure every component story (not a page) and, with `write`, set the frames in its story file. */
export async function measureFrames(config: ResolvedConfig, options: FramesOptions = {}): Promise<FramesResult> {
  const q = options.filter?.toLowerCase()
  const stories = (await buildIndex(config)).filter((s) => !s.hasPage && (!q || `${s.id} ${s.title} ${s.file}`.toLowerCase().includes(q)))
  let url = await findRunningServer(config)
  let ephemeral: Awaited<ReturnType<typeof createStageboardServer>> | undefined
  if (!url) {
    ephemeral = await createStageboardServer(config, { port: 0, watch: false, quiet: true, host: "127.0.0.1" })
    url = ephemeral.url
  }
  const browser = await launchBrowser()
  const measure = async (s: IndexedStory, viewport: Frame) => {
    const page = await browser.newPage({ viewport, reducedMotion: "reduce", colorScheme: "light" })
    try {
      await page.goto(`${url}${API_BASE}/frame.html?${new URLSearchParams({ story: s.id, "sb-shot": "1" })}`, { waitUntil: "load", timeout: 60_000 })
      await page.waitForFunction(() => (window as any).__STAGEBOARD_READY__ === true || (window as any).__STAGEBOARD_ERROR__, undefined, { timeout: 30_000 }).catch(() => {})
      const error = await page.evaluate(() => (window as any).__STAGEBOARD_ERROR__ as string | undefined)
      if (error) throw new Error(error.split("\n")[0])
      // A page only known once loaded (its parameters come from a helper) is a screen, at the device's size; a
      // fullscreen story is usually the whole app in some state and keeps a page-sized frame.
      if (await page.evaluate(() => Boolean((window as any).__STAGEBOARD_ROUTE__) || (window as any).__STAGEBOARD_LAYOUT__ === "fullscreen")) return undefined
      await page.evaluate(() => document.fonts?.ready)
      await page.waitForTimeout(300)
      return await page.evaluate(measurePage)
    } finally {
      await page.close().catch(() => {})
    }
  }
  const results: FramesResult["stories"] = []
  try {
    const queue = [...stories]
    let done = 0
    await Promise.all(
      Array.from({ length: options.concurrency ?? 4 }, async () => {
        for (let s = queue.shift(); s; s = queue.shift()) {
          try {
            const wide = await measure(s, { width: 1440, height: 900 })
            if (!wide) {
              results.push({ id: s.id, file: s.file, exportName: s.exportName, page: true })
              continue
            }
            // Content that grows with the page is fluid: what it needs is what it draws in a narrower page.
            const fluid = wide.width > 1100 ? await measure(s, { width: 1024, height: 900 }) : undefined
            const need: Need = fluid ? { width: fluid.width, height: fluid.height, overlay: wide.overlay, fluid: true } : wide
            let frame = frameFor(need, s.file)
            // Rendered in its frame, a story may lay out differently (breakpoints): grow the frame to what it then needs.
            const check = await measure(s, frame)
            if (check && (check.scrollWidth > frame.width || check.scrollHeight > frame.height))
              frame = { width: Math.max(frame.width, up(check.scrollWidth, 10)), height: Math.max(frame.height, up(check.scrollHeight, 10)) }
            results.push({ id: s.id, file: s.file, exportName: s.exportName, need, frame })
          } catch (e) {
            results.push({ id: s.id, file: s.file, exportName: s.exportName, error: (e as Error).message.slice(0, 200) })
          } finally {
            options.onProgress?.(++done, stories.length)
          }
        }
      }),
    )
  } finally {
    await browser.close().catch(() => {})
    await ephemeral?.close()
  }
  const plans = planFrames(results.flatMap((r) => (r.frame ? [{ exportName: r.exportName, file: r.file, frame: r.frame }] : [])))
  const written: string[] = []
  const skipped: string[] = []
  for (const plan of plans) {
    const abs = path.resolve(config.root, plan.file)
    const before = fs.readFileSync(abs, "utf8")
    const after = writeFrames(before, plan)
    skipped.push(...after.skipped.map((s) => `${plan.file} ${s}`))
    if (options.write && after.source !== before) {
      fs.writeFileSync(abs, after.source)
      written.push(plan.file)
    }
  }
  return { stories: results, plans, written, skipped }
}
