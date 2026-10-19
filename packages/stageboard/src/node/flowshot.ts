import fs from "node:fs"
import path from "node:path"
import { DEVICES, formatAction, type Device, type Flow, type FlowAction, type FlowStep } from "../core/protocol"
import type { ResolvedConfig } from "./config"
import { buildIndex } from "./indexer"
import { createStageboardServer, findRunningServer } from "./server"
import { launchBrowser, openFrame } from "./shot"

export type FlowShotOptions = {
  flow: string
  device?: Device
  theme?: "light" | "dark"
  columns?: number
  out?: string
}

export type FlowShotStep = { index: number; storyId?: string; title: string; route?: string; note?: string; actions?: FlowAction[]; played?: { index: number; ok: boolean; error?: string }[]; error?: string }

export type FlowShotResult = { file: string; flow: Flow; steps: FlowShotStep[]; durationMs: number }

type Board = { flows?: Flow[]; dreams?: { id: string; storyId?: string; name?: string }[] }

// Each screen is captured at the device size and shown at this width in the grid.
const CELL_WIDTH: Record<Device, number> = { desktop: 720, tablet: 420, mobile: 300 }
const COLUMNS: Record<Device, number> = { desktop: 3, tablet: 4, mobile: 5 }

function readBoard(config: ResolvedConfig): Board {
  try {
    return JSON.parse(fs.readFileSync(path.join(config.root, "stageboard", "board.json"), "utf8"))
  } catch {
    return {}
  }
}

export function matchFlow(flows: Flow[], query: string): Flow {
  const exact = flows.find((f) => f.id === query || f.name.toLowerCase() === query.toLowerCase())
  if (exact) return exact
  const q = query.toLowerCase()
  const fuzzy = flows.filter((f) => f.name.toLowerCase().includes(q))
  if (fuzzy.length === 1) return fuzzy[0]
  const list = (fuzzy.length ? fuzzy : flows).map((f) => `  ${f.id}  ${f.name}`).join("\n")
  throw new Error(fuzzy.length ? `"${query}" matches ${fuzzy.length} flows:\n${list}` : `No flow matches "${query}". Flows:\n${list || "  (none)"}`)
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

function gridHtml(flow: Flow, steps: (FlowShotStep & { image?: string })[], device: Device, columns: number): string {
  const d = DEVICES[device]
  const width = CELL_WIDTH[device]
  const height = Math.round((width * d.height) / d.width)
  const cells = steps
    .map((s) => {
      const shot = s.image
        ? `<img src="data:image/png;base64,${s.image}" width="${width}" height="${height}" />`
        : `<div class="missing" style="height:${height}px">${esc(s.error ?? "Not built yet")}</div>`
      const action = (s.actions ?? [])
        .map((a, i) => {
          const r = s.played?.find((p) => p.index === i)
          const mark = !r ? "·" : r.ok ? "✓" : "✗"
          return `<div class="action" data-ok="${r ? r.ok : "skipped"}">${mark} ${esc(formatAction(a))}${r?.error ? ` <span class="target">${esc(r.error)}</span>` : ""}</div>`
        })
        .join("")
      return `<figure>
        <div class="head"><span class="num">${s.index + 1}</span><span class="title">${esc(s.title)}</span>${s.route ? `<span class="route">${esc(s.route)}</span>` : ""}</div>
        <div class="shot">${shot}</div>
        ${s.note ? `<div class="note">${esc(s.note)}</div>` : ""}${action}
      </figure>`
    })
    .join("")
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    body { margin: 0; padding: 28px; background: #0e0e11; color: #ededf0; font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, sans-serif; width: max-content; }
    h1 { margin: 0 0 4px; font-size: 22px; font-weight: 600; }
    .desc { margin: 0 0 22px; max-width: ${columns * width}px; color: #a9a9b3; }
    .grid { display: grid; grid-template-columns: repeat(${columns}, ${width}px); gap: 28px 22px; align-items: start; }
    figure { margin: 0; }
    .head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; min-width: 0; }
    .num { flex: none; display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 999px; background: #8d7af6; color: #fff; font-weight: 600; font-size: 13px; }
    .title { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .route { color: #85858f; font: 12px ui-monospace, Menlo, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .shot { border-radius: 10px; overflow: hidden; box-shadow: 0 0 0 1px rgba(255,255,255,.12); line-height: 0; }
    .missing { display: grid; place-items: center; background: #1a1a20; color: #85858f; line-height: 1.4; padding: 0 20px; text-align: center; }
    .note { margin-top: 8px; color: #d9d9e0; }
    .action { margin-top: 4px; color: #c9bfff; font-weight: 500; font-size: 13px; }
    .action[data-ok="false"] { color: #f0a090; }
    .action[data-ok="skipped"] { color: #85858f; }
    .target { color: #8f86c9; font-weight: 400; }
  </style></head><body>
    <h1>${esc(flow.name)} <span style="color:#85858f;font-weight:400;font-size:15px">· ${steps.length} screens · ${d.label} ${d.width}×${d.height}</span></h1>
    ${flow.description ? `<p class="desc">${esc(flow.description)}</p>` : `<p class="desc"></p>`}
    <div class="grid">${cells}</div>
  </body></html>`
}

export type CapturedStep = FlowShotStep & { image?: Buffer }

export type CaptureOptions = { flow: string; device?: Device; theme?: "light" | "dark"; scale?: number; type?: "png" | "jpeg"; quality?: number; play?: boolean }

export async function captureFlow(config: ResolvedConfig, options: CaptureOptions): Promise<{ flow: Flow; steps: CapturedStep[] }> {
  const board = readBoard(config)
  const flow = matchFlow(board.flows ?? [], options.flow)
  const d = DEVICES[options.device ?? "desktop"]
  const index = await buildIndex(config)
  const storyOf = (s: FlowStep) => s.storyId ?? (s.dream ? board.dreams?.find((x) => x.id === s.dream)?.storyId : undefined)

  let url = await findRunningServer(config)
  let ephemeral: Awaited<ReturnType<typeof createStageboardServer>> | undefined
  if (!url) {
    ephemeral = await createStageboardServer(config, { port: 0, watch: false, quiet: true, host: "127.0.0.1" })
    url = ephemeral.url
  }
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({
      viewport: { width: d.width, height: d.height },
      deviceScaleFactor: options.scale ?? 1,
      colorScheme: options.theme,
      reducedMotion: "reduce",
    })
    const steps: CapturedStep[] = []
    for (const [i, s] of flow.steps.entries()) {
      const storyId = storyOf(s)
      const story = storyId ? index.find((e) => e.id === storyId) : undefined
      const base: FlowShotStep = { index: i, storyId, title: story?.name ?? s.pending ?? storyId ?? "Not built yet", note: s.note, actions: s.actions }
      if (!storyId || !story) {
        steps.push({ ...base, error: storyId ? `Missing story ${storyId}` : `Not built yet${s.pending ? `: ${s.pending}` : ""}` })
        continue
      }
      try {
        await openFrame(page, url, storyId, { theme: options.theme })
        const route = await page.evaluate(() => (window as any).__STAGEBOARD_ROUTE__ as string | undefined)
        const title = await page.evaluate(() => ((window as any).__STAGEBOARD_TITLE__ as string | undefined) ?? document.title)
        const played = options.play !== false && s.actions?.length
          ? await page.evaluate((actions) => (window as any).__stageboard_play(actions) as Promise<{ index: number; ok: boolean; error?: string }[]>, s.actions)
          : undefined
        if (played) await page.waitForTimeout(250)
        const image = await page.screenshot({ type: options.type ?? "png", ...(options.type === "jpeg" ? { quality: options.quality ?? 82 } : {}) })
        steps.push({ ...base, route, title: title && title !== "stageboard frame" ? title : base.title, image, played })
      } catch (e) {
        steps.push({ ...base, error: (e as Error).message.split("\n")[0] })
      }
    }
    return { flow, steps }
  } finally {
    await browser.close()
    await ephemeral?.close()
  }
}

// Render every screen of a flow, in order, into one grid image with what happens on each and what the user does next.
export async function shootFlow(config: ResolvedConfig, options: FlowShotOptions): Promise<FlowShotResult> {
  const started = Date.now()
  const device = options.device ?? "desktop"
  const { flow, steps } = await captureFlow(config, { flow: options.flow, device, theme: options.theme, scale: CELL_WIDTH[device] / DEVICES[device].width })
  const columns = Math.max(1, Math.min(options.columns ?? COLUMNS[device], steps.length || 1))
  const browser = await launchBrowser()
  try {
    const grid = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 })
    await grid.setContent(gridHtml(flow, steps.map((s) => ({ ...s, image: s.image?.toString("base64") })), device, columns), { waitUntil: "load" })
    const out = path.resolve(options.out ?? path.join(config.stateDir, "shots", `flow-${flow.id}-${device}${options.theme ? `-${options.theme}` : ""}.png`))
    fs.mkdirSync(path.dirname(out), { recursive: true })
    await grid.screenshot({ path: out, fullPage: true })
    return { file: out, flow, steps: steps.map(({ image: _image, ...s }) => s), durationMs: Date.now() - started }
  } finally {
    await browser.close()
  }
}

// The same flow as text, next to the image, so a model reads the steps exactly.
export function flowOutline(result: FlowShotResult): string {
  const lines = [`${result.flow.name} (${result.flow.id})${result.flow.description ? `: ${result.flow.description}` : ""}`]
  for (const s of result.steps) {
    lines.push(`${s.index + 1}. ${s.title}${s.storyId ? ` [${s.storyId}]` : ""}${s.route ? ` ${s.route}` : ""}${s.error ? ` (${s.error})` : ""}`)
    if (s.note) lines.push(`   ${s.note}`)
    for (const [i, a] of (s.actions ?? []).entries()) {
      const r = s.played?.find((p) => p.index === i)
      lines.push(`   ${!r ? "·" : r.ok ? "✓" : "✗"} ${formatAction(a)}${r?.error ? ` (${r.error})` : ""}`)
    }
  }
  return lines.join("\n")
}
