import fs from "node:fs"
import path from "node:path"
import fg from "fast-glob"
import { storyNameFromExport, titleFromPath, toStoryId, type StoryEntry, type Viewport } from "../core/stories"
import type { ResolvedConfig } from "./config"

export type IndexedStory = StoryEntry & { absFile: string; hasPage: boolean; dream?: string }

const DEFAULT_IGNORE = ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/.stageboard/**"]

const EXPORT_RE = /export\s+(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g
const TITLE_RE = /\btitle\s*:\s*(["'`])([^"'`]+)\1/
const DREAM_RE = /\bdream\s*:\s*(["'`])([\w-]+)\1/
const STORY_NAME_RE = /\bname\s*:\s*(["'`])([^"'`]+)\1/
const ROUTE_RE = /\broute\s*:\s*["'`]/
const PAGE_REF_RE = /\bpage\s*:\s*(?!undefined\b|null\b|false\b)[A-Za-z_$]|\bpage\s*:\s*\{\s*\.\.\./

function storyBlock(source: string, start: number): string {
  const next = source.slice(start + 1).search(/\bexport\s+(?:const|let|var|function|default)\b/)
  return next === -1 ? source.slice(start) : source.slice(start, start + 1 + next)
}

// The balanced `{ ... }` starting at `open`, skipping comments and "…" or `…` strings (not '…', which JSX text uses as an apostrophe).
export function objectAt(source: string, open: number): string | undefined {
  if (source[open] !== "{") return undefined
  let depth = 0
  for (let i = open; i < source.length; i++) {
    const c = source[i]
    if (c === '"' || c === "`") {
      for (i++; i < source.length && source[i] !== c; i++) if (source[i] === "\\") i++
    } else if (c === "/" && source[i + 1] === "/") {
      i = source.indexOf("\n", i)
      if (i === -1) return undefined
    } else if (c === "/" && source[i + 1] === "*") {
      i = source.indexOf("*/", i + 2) + 1
      if (i === 0) return undefined
    } else if (c === "{") depth++
    else if (c === "}" && --depth === 0) return source.slice(open, i + 1)
  }
  return undefined
}

function objectAfter(source: string, from: number): string | undefined {
  const m = /^[^=;{]*=\s*/.exec(source.slice(from))
  return m ? objectAt(source, from + m[0].length) : undefined
}

// Only the object's own keys: nested objects and arrays are blanked out, keeping offsets.
export function topLevel(obj: string): string {
  let out = ""
  let depth = 0
  for (let i = 0; i < obj.length; i++) {
    const c = obj[i]
    if (c === "{" || c === "[") depth++
    out += depth <= 1 ? c : " "
    if (c === "}" || c === "]") depth--
  }
  return out
}

export function metaObject(source: string): string | undefined {
  const m = /export\s+default\s+/.exec(source)
  if (!m) return undefined
  const at = m.index + m[0].length
  if (source[at] === "{") return objectAt(source, at)
  const name = /^[A-Za-z_$][\w$]*/.exec(source.slice(at))?.[0]
  if (!name) return undefined
  const decl = new RegExp(`(?:const|let|var)\\s+${name.replace(/\$/g, "\\$")}\\b`).exec(source)
  return decl ? objectAfter(source, decl.index + decl[0].length) : undefined
}

function spreads(obj: string, names: Set<string>): boolean {
  return [...obj.matchAll(/\.\.\.\s*([A-Za-z_$][\w$]*)/g)].some((m) => names.has(m[1]))
}

// A story is a screen when its own or its meta's parameters set page.route, or it takes them from a screen story.
function hasRoute(obj: string | undefined, screens = new Set<string>()): boolean {
  if (!obj) return false
  const own = topLevel(obj)
  const at = /\bparameters\s*:/.exec(own)
  // `{ ...page({ route: "/patients" }), decorators }`: the spread of a call that sets a route.
  if (!at) return spreads(own, screens) || (/\.\.\.\s*[A-Za-z_$][\w$.]*\s*\(/.test(own) && ROUTE_RE.test(obj))
  const value = obj.slice(at.index + at[0].length).trimStart()
  const params = objectAt(value, 0)
  if (!params) return screens.has(/^([A-Za-z_$][\w$]*)\.parameters\b/.exec(value)?.[1] ?? "")
  return ROUTE_RE.test(params) || PAGE_REF_RE.test(params) || spreads(params, screens)
}

// The frame a story asks for in its own `parameters.viewport`, when written as numbers: what a component renders in.
function viewportOf(obj: string | undefined): Viewport | undefined {
  // topLevel blanks the nested object's own brace, so find the key there and the object in the original.
  const valueOf = (source: string, key: string) => {
    const at = new RegExp(`\\b${key}\\s*:`).exec(topLevel(source))
    if (!at) return undefined
    const rest = source.slice(at.index + at[0].length)
    return objectAt(rest, rest.length - rest.trimStart().length)
  }
  const params = obj && valueOf(obj, "parameters")
  const value = params && valueOf(params, "viewport")
  const width = value && /\bwidth\s*:\s*(\d+)/.exec(value)?.[1]
  if (!width) return undefined
  const height = /\bheight\s*:\s*(\d+)/.exec(value!)?.[1]
  return { width: Number(width), ...(height ? { height: Number(height) } : {}) }
}

function layoutOf(obj: string | undefined): StoryEntry["layout"] {
  const at = obj && /\bparameters\s*:/.exec(topLevel(obj))
  if (!at) return undefined
  const rest = obj!.slice(at.index + at[0].length)
  const params = objectAt(rest, rest.length - rest.trimStart().length)
  return params ? (/\blayout\s*:\s*["'`](centered|padded|fullscreen)["'`]/.exec(topLevel(params))?.[1] as StoryEntry["layout"]) : undefined
}

// Local helpers that set a route, such as `const at = (id) => page({ route: `/settings/${id}` })` or
// `const state = (t) => ({ page: { route: "/x", title: t } })`: a story that calls one is a page too.
function routeHelpers(source: string): string[] {
  const out: string[] = []
  for (const m of source.matchAll(/^(?:export\s+)?(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (/^[A-Z]/.test(m[1]) && /^export/.test(m[0])) continue
    const rest = source.slice(m.index! + m[0].length)
    const end = rest.search(/\n(?:export|const|let|var|function|type|interface|import|class)\b/)
    if (ROUTE_RE.test(end === -1 ? rest : rest.slice(0, end))) out.push(m[1])
  }
  return out
}

export async function storyFiles(config: ResolvedConfig): Promise<string[]> {
  return fg(config.stories, {
    cwd: config.root,
    absolute: true,
    ignore: [...DEFAULT_IGNORE, ...(config.ignore ?? [])],
  })
}

export function indexFile(config: ResolvedConfig, absFile: string): IndexedStory[] {
  const source = fs.readFileSync(absFile, "utf8")
  const file = path.relative(config.root, absFile).split(path.sep).join("/")
  const meta = metaObject(source)
  const title = (meta && TITLE_RE.exec(topLevel(meta))?.[2]) ?? titleFromPath(file)
  const metaPage = hasRoute(meta)
  const metaViewport = viewportOf(meta)
  const metaLayout = layoutOf(meta)
  const helpers = routeHelpers(source)
  const callsHelper = (text: string) => helpers.some((h) => new RegExp(`(?<![\\w$.])${h.replace(/\$/g, "\\$")}\\s*\\(`).test(text))
  const out: IndexedStory[] = []
  const screens = new Set<string>()
  for (const m of source.matchAll(EXPORT_RE)) {
    const exportName = m[1]
    if (exportName === "default" || exportName.startsWith("__")) continue
    if (/^[a-z]/.test(exportName)) continue
    const start = m.index ?? 0
    const obj = objectAfter(source, start + m[0].length)
    const block = obj ?? storyBlock(source, start).replace(/^export\s+(?:const|let|var|function)\s+\w+/, "")
    const custom = STORY_NAME_RE.exec(topLevel(block))?.[2]
    const dream = DREAM_RE.exec(block)?.[2]
    const page = metaPage || (obj ? hasRoute(obj, screens) : ROUTE_RE.test(block)) || callsHelper(obj ?? block)
    if (page) screens.add(exportName)
    const viewport = viewportOf(obj) ?? metaViewport
    const layout = layoutOf(obj) ?? metaLayout
    out.push({
      id: toStoryId(title, exportName),
      title,
      name: custom ?? storyNameFromExport(exportName),
      exportName,
      file,
      absFile,
      hasPage: page || Boolean(dream),
      ...(dream ? { dream } : {}),
      ...(viewport ? { viewport } : {}),
      ...(layout ? { layout } : {}),
    })
  }
  return out
}

export async function buildIndex(config: ResolvedConfig): Promise<IndexedStory[]> {
  const files = await storyFiles(config)
  return files.flatMap((f) => indexFile(config, f)).sort((a, b) => a.title.localeCompare(b.title))
}
