import fs from "node:fs"
import path from "node:path"
import fg from "fast-glob"
import { storyNameFromExport, titleFromPath, toStoryId, type StoryEntry } from "../core/stories"
import type { ResolvedConfig } from "./config"

export type IndexedStory = StoryEntry & { absFile: string; hasPage: boolean }

const DEFAULT_IGNORE = ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/.stageboard/**"]

const EXPORT_RE = /export\s+(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g
const TITLE_RE = /\btitle\s*:\s*(["'`])([^"'`]+)\1/
const STORY_NAME_RE = /^[^=]*=\s*\{[\s\S]*?\bname\s*:\s*(["'`])([^"'`]+)\1/

function storyBlock(source: string, start: number): string {
  const next = source.slice(start + 1).search(/\bexport\s+(?:const|let|var|function|default)\b/)
  return next === -1 ? source.slice(start) : source.slice(start, start + 1 + next)
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
  const defaultBlock = source.slice(source.search(/export\s+default/))
  const titleMatch = source.search(/export\s+default/) >= 0 ? TITLE_RE.exec(defaultBlock) ?? TITLE_RE.exec(source) : TITLE_RE.exec(source)
  const title = titleMatch?.[2] ?? titleFromPath(file)
  const hasPage = /\bpage\s*:\s*\{/.test(source)
  const out: IndexedStory[] = []
  for (const m of source.matchAll(EXPORT_RE)) {
    const exportName = m[1]
    if (exportName === "default" || exportName.startsWith("__")) continue
    if (/^[a-z]/.test(exportName)) continue
    const custom = STORY_NAME_RE.exec(storyBlock(source, m.index ?? 0).replace(/^export\s+(?:const|let|var|function)\s+\w+/, ""))?.[2]
    out.push({
      id: toStoryId(title, exportName),
      title,
      name: custom ?? storyNameFromExport(exportName),
      exportName,
      file,
      absFile,
      hasPage,
    })
  }
  return out
}

export async function buildIndex(config: ResolvedConfig): Promise<IndexedStory[]> {
  const files = await storyFiles(config)
  return files.flatMap((f) => indexFile(config, f)).sort((a, b) => a.title.localeCompare(b.title))
}
