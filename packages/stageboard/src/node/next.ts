import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import type { InlineConfig, Plugin } from "vite"

export type NextPresetOptions = {
  root?: string
  aliases?: Record<string, string>
  env?: Record<string, string | undefined>
}

const require = createRequire(import.meta.url)

function shim(name: string): string {
  return require.resolve(`stageboard/shims/next/${name}`)
}

function tsconfigAliases(root: string): Record<string, string> {
  const file = path.join(root, "tsconfig.json")
  if (!fs.existsSync(file)) return {}
  try {
    const text = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|(^|[^:"])\/\/.*$/gm, "$1").replace(/,(\s*[}\]])/g, "$1")
    const json = JSON.parse(text)
    const baseUrl = path.resolve(root, json.compilerOptions?.baseUrl ?? ".")
    const out: Record<string, string> = {}
    for (const [key, targets] of Object.entries<string[]>(json.compilerOptions?.paths ?? {})) {
      if (!targets?.length) continue
      const from = key.replace(/\/\*$/, "")
      const to = path.resolve(baseUrl, targets[0].replace(/\/\*$/, ""))
      out[from] = to
    }
    return out
  } catch {
    return {}
  }
}

function loadEnvFiles(root: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of [".env", ".env.development", ".env.local", ".env.development.local"]) {
    const file = path.join(root, name)
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = /^\s*(NEXT_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  }
  return out
}

const FONT_IMPORT = /import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["']next\/font\/(google|local)["'];?/g

function nextFontPlugin(): Plugin {
  const fontModule = shim("font")
  return {
    name: "stageboard:next-font",
    enforce: "pre",
    transform(code, id) {
      if (!code.includes("next/font/") || id.includes("node_modules")) return
      let used = false
      const out = code.replace(FONT_IMPORT, (_m, def: string | undefined, named: string | undefined) => {
        used = true
        const decls: string[] = []
        if (def) decls.push(`${def} = __sbFont("local")`)
        for (const part of (named ?? "").split(",").map((p) => p.trim()).filter(Boolean)) {
          const [orig, local] = part.split(/\s+as\s+/).map((p) => p.trim())
          decls.push(`${local ?? orig} = __sbFont(${JSON.stringify(orig)})`)
        }
        return decls.length ? `const ${decls.join(", ")};` : ""
      })
      if (!used) return
      return { code: `import { createFont as __sbFont } from ${JSON.stringify(fontModule)};\n${out}`, map: null }
    },
  }
}

export function nextPreset(options: NextPresetOptions = {}): InlineConfig {
  const root = options.root ?? process.cwd()
  const env = { ...loadEnvFiles(root), ...options.env, NODE_ENV: "development" }
  const paths = tsconfigAliases(root)
  const alias = [
    { find: /^next\/image$/, replacement: shim("image") },
    { find: /^next\/legacy\/image$/, replacement: shim("image") },
    { find: /^next\/link$/, replacement: shim("link") },
    { find: /^next\/navigation$/, replacement: shim("navigation") },
    { find: /^next\/router$/, replacement: shim("navigation") },
    { find: /^next\/dynamic$/, replacement: shim("dynamic") },
    { find: /^next\/script$/, replacement: shim("script") },
    { find: /^next\/head$/, replacement: shim("head") },
    ...Object.entries({ ...paths, ...options.aliases })
      .sort((a, b) => b[0].length - a[0].length)
      .map(([find, replacement]) => ({
        find: new RegExp(`^${find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=/|$)`),
        replacement,
      })),
  ]
  return {
    plugins: [nextFontPlugin()],
    resolve: { alias },
    define: {
      "process.env": JSON.stringify(env),
      "process.browser": "true",
      global: "globalThis",
    },
    publicDir: path.join(root, "public"),
  }
}
