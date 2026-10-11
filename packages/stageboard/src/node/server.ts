import fs from "node:fs"
import path from "node:path"
import type { Plugin, ViteDevServer, InlineConfig } from "vite"
import { API_BASE } from "../core/protocol"
import { Bridge } from "./bridge"
import type { ResolvedConfig } from "./config"
import { buildIndex } from "./indexer"
import { writeVariantsModule } from "./variants"

const BASE = `${API_BASE}/`
const V = {
  index: "virtual:stageboard/index",
  preview: "virtual:stageboard/preview",
  variants: "virtual:stageboard/variants",
  frame: "virtual:stageboard/frame-entry",
  ui: "virtual:stageboard/ui-entry",
}
const RESOLVED_PREFIX = "\0"

const html = (title: string, entry: string, bodyClass = "") => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="data:," />
    <title>${title}</title>
  </head>
  <body class="${bodyClass}">
    <div id="root"></div>
    <script type="module">import(${JSON.stringify(entry)}).catch((e) => { window.__STAGEBOARD_ERROR__ = String(e && e.stack || e); console.error(e) })</script>
  </body>
</html>`

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".avif": "image/avif", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp4": "video/mp4", ".webm": "video/webm",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".json": "application/json",
  ".txt": "text/plain; charset=utf-8", ".pdf": "application/pdf", ".css": "text/css", ".js": "text/javascript",
}

function servePublic(server: ViteDevServer, pathname: string, res: import("node:http").ServerResponse): boolean {
  const publicDir = server.config.publicDir
  if (!publicDir || pathname === "/" || pathname.includes("..")) return false
  const file = path.join(publicDir, decodeURIComponent(pathname))
  if (!file.startsWith(publicDir)) return false
  let stat: fs.Stats
  try {
    stat = fs.statSync(file)
  } catch {
    return false
  }
  if (!stat.isFile()) return false
  res.setHeader("content-type", MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream")
  res.setHeader("content-length", stat.size)
  fs.createReadStream(file).pipe(res)
  return true
}

export type ServerOptions = {
  port?: number
  host?: string | boolean
  watch?: boolean
  quiet?: boolean
}

export function stageboardPlugin(config: ResolvedConfig, bridge: Bridge): Plugin {
  const storyGlobsMatch = (file: string) => /\.stories\.[cm]?[jt]sx?$/.test(file)
  const variantMatch = (file: string) => /\.variant\.[cm]?[jt]sx?$/.test(file)
  let server: ViteDevServer | undefined

  return {
    name: "stageboard",
    enforce: "pre",
    resolveId(id) {
      if (Object.values(V).includes(id)) return RESOLVED_PREFIX + id
    },
    async load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return
      const virtualId = id.slice(RESOLVED_PREFIX.length)
      if (virtualId === V.index) {
        const index = await buildIndex(config)
        const files = [...new Set(index.map((s) => s.absFile))]
        const entries = index.map(({ absFile: _abs, ...rest }) => rest)
        return [
          `export const index = ${JSON.stringify(entries)}`,
          "export const loaders = {",
          ...files.map((f) => `  ${JSON.stringify(path.relative(config.root, f).split(path.sep).join("/"))}: () => import(${JSON.stringify(f)}),`),
          "}",
        ].join("\n")
      }
      if (virtualId === V.preview) {
        if (!config.preview) return "export const decorators = []; export const parameters = {}"
        const abs = path.resolve(config.root, config.preview)
        return `export * from ${JSON.stringify(abs)}`
      }
      if (virtualId === V.variants) {
        if (!fs.existsSync(config.variantsFile)) await writeVariantsModule(config)
        return `import ${JSON.stringify(config.variantsFile)}`
      }
      if (virtualId === V.frame) {
        return [
          `import * as preview from ${JSON.stringify(V.preview)}`,
          `import ${JSON.stringify(V.variants)}`,
          `import { index, loaders } from ${JSON.stringify(V.index)}`,
          `import { renderFrame } from "stageboard/client"`,
          `renderFrame(document.getElementById("root"), { index, loaders, preview, base: ${JSON.stringify(API_BASE)} })`,
          `if (import.meta.hot) import.meta.hot.accept()`,
        ].join("\n")
      }
      if (virtualId === V.ui) {
        return [
          `import { index, loaders } from ${JSON.stringify(V.index)}`,
          `import { mountUI } from "stageboard/client"`,
          `mountUI(document.getElementById("root"), { index, loaders, base: ${JSON.stringify(API_BASE)} })`,
        ].join("\n")
      }
    },
    configureServer(s) {
      server = s
      s.middlewares.use(async (req, res, next) => {
        const raw = req.originalUrl ?? req.url ?? "/"
        const url = new URL(raw, "http://x")
        let pathname = url.pathname
        if (!pathname.startsWith(API_BASE) && servePublic(s, pathname, res)) return
        if (!pathname.startsWith(API_BASE)) pathname = API_BASE + (pathname.startsWith("/") ? pathname : `/${pathname}`)
        const sub = pathname.slice(API_BASE.length) || "/"
        if (sub.startsWith("/api/")) {
          if (await bridge.handle(req, res, sub.slice(4))) return
        }
        if (sub === "/" || sub === "/index.html" || sub === "/canvas" || sub.startsWith("/story/")) {
          res.setHeader("content-type", "text/html")
          res.end(await s.transformIndexHtml(raw, html("stageboard", V.ui, "sb-ui")))
          return
        }
        if (sub === "/frame.html" || sub === "/frame") {
          res.setHeader("content-type", "text/html")
          res.end(await s.transformIndexHtml(raw, html("stageboard frame", V.frame)))
          return
        }
        next()
      })
      const onFs = (event: "add" | "unlink" | "change") => (file: string) => {
        if (variantMatch(file)) bridge.scheduleRescan()
        if (storyGlobsMatch(file) && (event !== "change" || true)) {
          const mod = s.moduleGraph.getModuleById(RESOLVED_PREFIX + V.index)
          if (mod) {
            s.moduleGraph.invalidateModule(mod)
            if (event !== "change") s.ws.send({ type: "full-reload" })
          }
        }
      }
      s.watcher.on("add", onFs("add"))
      s.watcher.on("unlink", onFs("unlink"))
      s.watcher.on("change", onFs("change"))
    },
    handleHotUpdate(ctx) {
      if (storyGlobsMatch(ctx.file) && server) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_PREFIX + V.index)
        if (mod) server.moduleGraph.invalidateModule(mod)
      }
    },
  }
}

async function resolveUserVite(config: ResolvedConfig): Promise<InlineConfig> {
  if (!config.vite) return {}
  return typeof config.vite === "function" ? await config.vite() : config.vite
}

async function reactPlugin(): Promise<Plugin[]> {
  try {
    const mod = await import("@vitejs/plugin-react")
    const react = (mod.default ?? mod) as unknown as (opts?: object) => Plugin | Plugin[]
    const out = react()
    return Array.isArray(out) ? out : [out]
  } catch {
    return []
  }
}

export type StageboardServer = {
  vite: ViteDevServer
  bridge: Bridge
  url: string
  close: () => Promise<void>
}

export async function createStageboardServer(config: ResolvedConfig, options: ServerOptions = {}): Promise<StageboardServer> {
  const { createServer, mergeConfig } = await import("vite")
  const bridge = new Bridge(config)
  await bridge.refreshVariants()
  const userVite = await resolveUserVite(config)
  const hasReact = (userVite.plugins ?? []).flat().some((p) => p && typeof p === "object" && "name" in p && String(p.name).startsWith("vite:react"))
  const publicUrl = config.publicUrl ?? process.env.STAGEBOARD_PUBLIC_URL
  const hmr = publicUrl
    ? (() => {
        const u = new URL(publicUrl)
        return { protocol: u.protocol === "https:" ? "wss" : "ws", host: u.hostname, clientPort: Number(u.port || (u.protocol === "https:" ? 443 : 80)) }
      })()
    : undefined
  const base: InlineConfig = {
    root: config.root,
    base: BASE,
    configFile: false,
    appType: "custom",
    cacheDir: path.join(config.stateDir, "vite"),
    logLevel: options.quiet ? "error" : "info",
    clearScreen: false,
    server: {
      port: options.port ?? config.port,
      host: options.host ?? true,
      strictPort: false,
      allowedHosts: true,
      hmr,
      watch: options.watch === false ? null : undefined,
    },
    plugins: [stageboardPlugin(config, bridge), ...(hasReact ? [] : await reactPlugin())],
    optimizeDeps: {
      entries: [...config.stories, ...(config.preview ? [config.preview] : [])],
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "stageboard/client", "stageboard/react"],
    },
  }
  const vite = await createServer(mergeConfig(base, userVite))
  await vite.listen()
  const address = vite.httpServer?.address()
  const port = typeof address === "object" && address ? address.port : config.port
  const url = `http://localhost:${port}`
  const rescan = setInterval(() => void bridge.refreshVariants(), 5000)
  const lockFile = path.join(config.stateDir, "server.json")
  if (options.watch !== false) fs.writeFileSync(lockFile, JSON.stringify({ port, pid: process.pid, url }))
  return {
    vite,
    bridge,
    url,
    close: async () => {
      clearInterval(rescan)
      if (options.watch !== false && fs.existsSync(lockFile)) {
        try {
          const lock = JSON.parse(fs.readFileSync(lockFile, "utf8"))
          if (lock.pid === process.pid) fs.unlinkSync(lockFile)
        } catch {}
      }
      await vite.close()
    },
  }
}

export async function findRunningServer(config: ResolvedConfig): Promise<string | undefined> {
  const lockFile = path.join(config.stateDir, "server.json")
  if (!fs.existsSync(lockFile)) return undefined
  try {
    const lock = JSON.parse(fs.readFileSync(lockFile, "utf8"))
    const res = await fetch(`${lock.url}${API_BASE}/api/state`, { signal: AbortSignal.timeout(1500) })
    return res.ok ? lock.url : undefined
  } catch {
    return undefined
  }
}
