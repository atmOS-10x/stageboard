import fs from "node:fs"
import path from "node:path"
import { API_BASE } from "../core/protocol"
import type { ResolvedConfig } from "./config"
import { buildIndex, type IndexedStory } from "./indexer"
import { createStageboardServer, findRunningServer } from "./server"

export type ShotOptions = {
  story: string
  variants?: string[]
  width?: number
  height?: number
  full?: boolean
  out?: string
  theme?: "light" | "dark"
  scale?: number
  timeout?: number
}

export type ShotResult = {
  file: string
  story: IndexedStory
  consoleErrors: string[]
  durationMs: number
}

const CHROME_CANDIDATES = [
  process.env.STAGEBOARD_CHROME,
  process.env.CHROME_PATH,
  "/usr/bin/chromium",
  "/usr/sbin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome-stable",
  "/usr/sbin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
]

async function launchBrowser() {
  const { chromium } = await import("playwright-core")
  let bundled: string | undefined
  try {
    bundled = chromium.executablePath()
  } catch {}
  const executablePath = [bundled, ...CHROME_CANDIDATES].find((p) => p && fs.existsSync(p))
  if (!executablePath) {
    throw new Error("No Chromium found. Set STAGEBOARD_CHROME or run `npx playwright install chromium`.")
  }
  return chromium.launch({ executablePath, headless: true, args: ["--disable-gpu", "--hide-scrollbars"] })
}

export function matchStory(index: IndexedStory[], query: string): IndexedStory {
  const exact = index.find((s) => s.id === query)
  if (exact) return exact
  const [file, exp] = query.split("#")
  if (exp) {
    const byFile = index.find((s) => (s.file === file || s.file.endsWith(file)) && s.exportName === exp)
    if (byFile) return byFile
  }
  const q = query.toLowerCase()
  const fuzzy = index.filter((s) => s.id.includes(q) || `${s.title}/${s.name}`.toLowerCase().includes(q))
  if (fuzzy.length === 1) return fuzzy[0]
  if (fuzzy.length > 1) {
    throw new Error(`"${query}" matches ${fuzzy.length} stories:\n${fuzzy.slice(0, 15).map((s) => `  ${s.id}`).join("\n")}`)
  }
  throw new Error(`No story matches "${query}". Run \`stageboard list\`.`)
}

export async function shoot(config: ResolvedConfig, options: ShotOptions): Promise<ShotResult> {
  const started = Date.now()
  const index = await buildIndex(config)
  const story = matchStory(index, options.story)
  let url = await findRunningServer(config)
  let ephemeral: Awaited<ReturnType<typeof createStageboardServer>> | undefined
  if (!url) {
    ephemeral = await createStageboardServer(config, { port: 0, watch: false, quiet: true, host: "127.0.0.1" })
    url = ephemeral.url
  }
  const browser = await launchBrowser()
  const consoleErrors: string[] = []
  try {
    const page = await browser.newPage({
      viewport: { width: options.width ?? 1280, height: options.height ?? 800 },
      deviceScaleFactor: options.scale ?? 1,
      colorScheme: options.theme,
    })
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text())
    })
    page.on("pageerror", (e) => consoleErrors.push(e.message))
    const params = new URLSearchParams({ story: story.id, "sb-shot": "1" })
    for (const v of options.variants ?? []) params.append("sb-variant", v.replace("=", ":"))
    if (options.theme) params.set("sb-theme", options.theme)
    await page.goto(`${url}${API_BASE}/frame.html?${params}`, { waitUntil: "load", timeout: options.timeout ?? 120_000 })
    await page.waitForFunction(
      () => (window as any).__STAGEBOARD_READY__ === true || (window as any).__STAGEBOARD_ERROR__,
      undefined,
      { timeout: options.timeout ?? 120_000 },
    )
    const error = await page.evaluate(() => (window as any).__STAGEBOARD_ERROR__ as string | undefined)
    if (error) throw new Error(`Story ${story.id} failed to render:\n${error}`)
    await page.evaluate(() => document.fonts?.ready)
    await page.waitForTimeout(150)
    const out = path.resolve(options.out ?? path.join(config.stateDir, "shots", `${story.id}${options.variants?.length ? "~" + options.variants.join(",").replace(/[^\w.,=-]/g, "_") : ""}.png`))
    fs.mkdirSync(path.dirname(out), { recursive: true })
    const layout = await page.evaluate(() => (window as any).__STAGEBOARD_LAYOUT__ as string | undefined)
    if (options.full || layout === "fullscreen") {
      await page.screenshot({ path: out, fullPage: Boolean(options.full) })
    } else {
      await page.locator("#sb-stage").screenshot({ path: out })
    }
    return { file: out, story, consoleErrors, durationMs: Date.now() - started }
  } finally {
    await browser.close()
    await ephemeral?.close()
  }
}
