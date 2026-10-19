import fs from "node:fs"
import compression from "compression"
import path from "node:path"
import type { Connect, Plugin, ViteDevServer, InlineConfig } from "vite"
import { API_BASE } from "../core/protocol"
import { Bridge } from "./bridge"
import type { ResolvedConfig } from "./config"
import { buildIndex } from "./indexer"
import { parseVariantParam, Thumbnailer } from "./thumbs"
import { IMAGE_TYPE, isReferenced, referenceFile } from "./references"
import { readUpload, saveUpload } from "./uploads"
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

// The plain boot screen frames show until their story renders.
const PLAIN_BOOT = `<div id="root"><div id="sb-boot" style="position:fixed;inset:0;display:grid;place-items:center;font:13px/1.5 ui-sans-serif,system-ui,sans-serif;color:#8a8a93;background:#fafafa">
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
        <div style="width:22px;height:22px;border-radius:999px;border:2px solid #e4e4e7;border-top-color:#71717a;animation:sbspin .8s linear infinite"></div>
        <div id="sb-boot-text">Loading…</div>
      </div>
      <style>@keyframes sbspin{to{transform:rotate(360deg)}}</style>
    </div></div>`

// The stageboard app boots dark, with the same pixel waves as a rendering screen across the whole window
// (a small copy of client/waves.tsx, since nothing is bundled yet), until the UI mounts over it.
const WAVE_BOOT = `<style>html,body{margin:0;background:#16151e}</style>
    <div id="root"><div id="sb-boot" style="position:fixed;inset:0;background:#16151e">
      <canvas id="sb-boot-waves" style="position:absolute;inset:0;width:100%;height:100%;display:block"></canvas>
      <div id="sb-boot-text" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:6px 14px;border-radius:999px;background:rgba(20,19,28,.72);font:500 12.5px/1.5 ui-sans-serif,system-ui,sans-serif;letter-spacing:.02em;color:#c9c5e6;white-space:nowrap">Loading stageboard</div>
    </div></div>
    <script>
      (function () {
        var canvas = document.getElementById("sb-boot-waves")
        var CELL = 10, DEEP = [22, 21, 30], SWELL = [74, 62, 150], CREST = [150, 132, 255], FOAM = [236, 233, 255]
        var TRAINS = [[0.92, 0.38, 0.42, 0.00035, 0.05, 1], [0.7, -0.71, 0.3, 0.00022, 0.06, 0.32]]
        function mix(a, b, t) { return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * t) + "," + Math.round(a[1] + (b[1] - a[1]) * t) + "," + Math.round(a[2] + (b[2] - a[2]) * t) + ")" }
        function shade(v) { return v < 0.45 ? mix(DEEP, SWELL, v / 0.45) : v < 0.9 ? mix(SWELL, CREST, (v - 0.45) / 0.45) : mix(CREST, FOAM, (v - 0.9) / 0.1) }
        function profile(p) { var f = p - Math.floor(p); return f < 0.2 ? Math.pow(f / 0.2, 1.6) : Math.exp(-(f - 0.2) * 1.5) }
        function height(x, y, w, t) {
          var top = 0, sum = 0
          for (var k = 0; k < TRAINS.length; k++) {
            var tr = TRAINS[k], along = (x * tr[0] + y * tr[1]) / (w * tr[2]), across = (-x * tr[1] + y * tr[0]) / w
            var h = profile(along - t * tr[3] + tr[4] * Math.sin(across * 4 + t * 0.0006)) * tr[5]
            top = Math.max(top, h); sum += h
          }
          return Math.min(1, top + (sum - top) * 0.3)
        }
        var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, start = performance.now(), last = 0
        function draw(now) {
          if (!canvas.isConnected) return
          if (last && now - last < 31) return requestAnimationFrame(draw)
          last = now
          var dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight
          if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr) }
          var ctx = canvas.getContext("2d"), t = reduce ? 0 : now - start
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          ctx.fillStyle = mix(DEEP, DEEP, 0); ctx.fillRect(0, 0, w, h)
          for (var i = 0; i < Math.ceil(w / CELL); i++) for (var j = 0; j < Math.ceil(h / CELL); j++) {
            var x = i * CELL + CELL / 2, y = j * CELL + CELL / 2, v = height(x, y, w, t), size = CELL * (0.42 + 0.5 * v)
            ctx.globalAlpha = 0.35 + 0.65 * v; ctx.fillStyle = shade(v); ctx.fillRect(x - size / 2, y - size / 2, size, size)
          }
          ctx.globalAlpha = 1
          if (!reduce) requestAnimationFrame(draw)
        }
        requestAnimationFrame(draw)
      })()
    </script>`

// The stageboard mark (.github/assets/icon.svg), so the tab shows it.
const FAVICON = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none"><defs><linearGradient id="b" x1="0" y1="0" x2="256" y2="256" gradientUnits="userSpaceOnUse"><stop stop-color="#1c1b24"/><stop offset="1" stop-color="#0f0f14"/></linearGradient><linearGradient id="t" x1="138" y1="138" x2="202" y2="202" gradientUnits="userSpaceOnUse"><stop stop-color="#a99cff"/><stop offset="1" stop-color="#6f8dff"/></linearGradient></defs><rect width="256" height="256" rx="58" fill="url(#b)"/><rect x="54" y="54" width="64" height="64" rx="16" stroke="#ececf1" stroke-width="9"/><rect x="138" y="54" width="64" height="64" rx="16" stroke="#ececf1" stroke-opacity=".45" stroke-width="9"/><rect x="54" y="138" width="64" height="64" rx="16" stroke="#ececf1" stroke-opacity=".45" stroke-width="9"/><rect x="133.5" y="133.5" width="73" height="73" rx="36.5" fill="url(#t)"/></svg>`,
)}`

const html = (title: string, entry: string, bodyClass = "") => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="${FAVICON}" />
    <title>${title}</title>
  </head>
  <body class="${bodyClass}">
    ${bodyClass === "sb-ui" ? WAVE_BOOT : PLAIN_BOOT}
    <script>
      (function () {
        var start = Date.now()
        var t = setInterval(function () {
          var el = document.getElementById("sb-boot-text")
          if (!el) return clearInterval(t)
          var n = performance.getEntriesByType("resource").length
          el.textContent = (el.dataset.label || (el.dataset.label = el.textContent.replace(/…$/, ""))) + "… " + n + " modules · " + Math.round((Date.now() - start) / 1000) + "s"
        }, 500)
      })()
    </script>
    <script type="module">import(${JSON.stringify(entry)}).catch((e) => {
      window.__STAGEBOARD_ERROR__ = String(e && e.stack || e); console.error(e)
      var root = document.getElementById("root")
      if (root) root.innerHTML = '<pre style="margin:16px;padding:16px;border-radius:8px;background:#2a1215;color:#ffb4a8;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap"></pre>'
      if (root && root.firstChild) root.firstChild.textContent = "Failed to load this story:\\n\\n" + window.__STAGEBOARD_ERROR__
    })</script>
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

export function stageboardPlugin(config: ResolvedConfig, bridge: Bridge, thumbs?: Thumbnailer): Plugin {
  const storyGlobsMatch = (file: string) => /\.stories\.[cm]?[jt]sx?$/.test(file)
  const variantMatch = (file: string) => /\.variant\.[cm]?[jt]sx?$/.test(file)
  let server: ViteDevServer | undefined
  // Every thumbnail asks which file its story is in; read the story files once until one of them changes.
  let cached: ReturnType<typeof buildIndex> | undefined
  const storyIndex = () => (cached ??= buildIndex(config).catch((e) => ((cached = undefined), Promise.reject(e))))

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
      s.middlewares.use(
        compression({
          threshold: 1024,
          filter: (req, res) => {
            const type = String(res.getHeader("content-type") ?? "")
            if (type.includes("event-stream") || req.headers.upgrade) return false
            return compression.filter(req, res)
          },
        }) as unknown as Connect.NextHandleFunction,
      )
      s.middlewares.use(async (req, res, next) => {
        const raw = req.originalUrl ?? req.url ?? "/"
        const url = new URL(raw, "http://x")
        let pathname = url.pathname
        if (!pathname.startsWith(API_BASE) && servePublic(s, pathname, res)) return
        if (!pathname.startsWith(API_BASE)) pathname = API_BASE + (pathname.startsWith("/") ? pathname : `/${pathname}`)
        const sub = pathname.slice(API_BASE.length) || "/"
        const thumb = /^\/api\/thumb\/([\w.-]+?)\.jpg$/.exec(sub)
        if (thumb && thumbs) {
          const index = await storyIndex()
          const entry = index.find((e) => e.id === thumb[1])
          const q = url.searchParams
          const scheme = (v: string | null) => (v === "dark" || v === "light" ? v : undefined)
          await thumbs.serve(res, thumb[1], entry?.absFile, q.has("refresh"), parseVariantParam(q.get("variant")), {
            width: q.get("w") ? Number(q.get("w")) : undefined,
            height: q.get("h") ? Number(q.get("h")) : undefined,
            scale: q.get("x") ? Math.min(3, Math.max(0.25, Number(q.get("x")) || 1)) : undefined,
            theme: scheme(q.get("t")),
            colorScheme: scheme(q.get("cs")),
          })
          return
        }
        if (sub === "/api/shot" && thumbs) {
          const q = url.searchParams
          const num = (k: string) => (q.get(k) ? Number(q.get(k)) : undefined)
          const region = q.get("rw") ? { x: num("x") ?? 0, y: num("y") ?? 0, width: num("rw")!, height: num("rh") ?? 1 } : undefined
          try {
            const png = await thumbs.shot(q.get("story") ?? "", {
              variants: parseVariantParam(q.get("variant")),
              width: num("w"),
              height: num("h"),
              full: q.has("full"),
              region,
              theme: q.get("t") === "dark" || q.get("t") === "light" ? (q.get("t") as "dark" | "light") : undefined,
              colorScheme: q.get("cs") === "dark" ? "dark" : undefined,
            })
            res.setHeader("content-type", "image/png")
            res.end(png)
          } catch (e) {
            res.statusCode = 500
            res.end((e as Error).message)
          }
          return
        }
        if (sub === "/api/describe" && thumbs) {
          const q = url.searchParams
          const n = (k: string) => Number(q.get(k) ?? 0)
          try {
            const description = await thumbs.describe(
              q.get("story") ?? "",
              { x: n("x"), y: n("y"), width: n("w") || 1, height: n("h") || 1 },
              { variants: parseVariantParam(q.get("variant")), width: q.get("vw") ? n("vw") : undefined, height: q.get("vh") ? n("vh") : undefined },
            )
            res.setHeader("content-type", "application/json")
            res.end(JSON.stringify(description))
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: (e as Error).message }))
          }
          return
        }
        if (sub === "/api/used-variants" && thumbs) {
          const index = await storyIndex()
          const map: Record<string, string[]> = {}
          for (const e of index) {
            const used = thumbs.usedVariants(e.id)
            if (used) map[e.id] = used
          }
          res.setHeader("content-type", "application/json")
          res.end(JSON.stringify(map))
          return
        }
        if (sub === "/api/uploads" && req.method === "POST") {
          try {
            const upload = await saveUpload(config, req)
            res.setHeader("content-type", "application/json")
            res.end(JSON.stringify(upload))
          } catch (e) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: (e as Error).message }))
          }
          return
        }
        if (sub === "/api/references" && req.method === "GET") {
          const image = url.searchParams.get("src") ?? ""
          if (!isReferenced(bridge.getState().flows, image)) {
            res.statusCode = 404
            res.end()
            return
          }
          try {
            const file = await referenceFile(config, image)
            res.setHeader("content-type", IMAGE_TYPE[path.extname(file).toLowerCase()] ?? "application/octet-stream")
            res.setHeader("cache-control", "max-age=3600")
            fs.createReadStream(file).pipe(res)
          } catch (e) {
            res.statusCode = 502
            res.end((e as Error).message)
          }
          return
        }
        const uploadGet = /^\/api\/uploads\/([\w.-]+)$/.exec(sub)
        if (uploadGet && req.method === "GET") {
          const found = readUpload(config, uploadGet[1])
          if (!found) {
            res.statusCode = 404
            res.end()
            return
          }
          res.setHeader("content-type", found.type)
          fs.createReadStream(found.path).pipe(res)
          return
        }
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
        if (storyGlobsMatch(file)) {
          cached = undefined
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
      if (storyGlobsMatch(ctx.file)) cached = undefined
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
  let serverUrl = ""
  const thumbs = new Thumbnailer(config, () => serverUrl, () => bridge.getState())
  bridge.setRenderer(thumbs)
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
    plugins: [stageboardPlugin(config, bridge, thumbs), ...(hasReact ? [] : await reactPlugin())],
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
  serverUrl = `http://127.0.0.1:${port}`
  const rescan = setInterval(() => void bridge.refreshVariants(), 5000)
  if (options.watch !== false) {
    setTimeout(() => {
      buildIndex(config)
        .then((index) => thumbs.warm(index.filter((s) => s.hasPage)))
        .catch(() => {})
    }, 3000)
  }
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
