import type { ComponentType, ReactNode } from "react"

export type Viewport = { width: number; height?: number }

/** The frame a component story renders in when it doesn't set `parameters.viewport`: 16:9, like the tile it shows in. */
export const COMPONENT_FRAME = { width: 640, height: 360 }
/** The same for a fullscreen one, which is usually the whole app in some state: a desktop page. */
export const FULLSCREEN_FRAME = { width: 1440, height: 810 }

/** A component story's frame: its own viewport, its height 16:9 to the width when left out. */
export function componentFrame(viewport?: Viewport, layout?: StageParameters["layout"]): { width: number; height: number } {
  if (!viewport?.width) return layout === "fullscreen" ? FULLSCREEN_FRAME : COMPONENT_FRAME
  return { width: viewport.width, height: viewport.height ?? Math.round((viewport.width * 9) / 16) }
}

export type PageParameters = {
  route: string
  title?: string
  links?: string[]
  group?: string
  dream?: string
  /** What `useParams()` returns in the story; derived from `path` when left out. */
  params?: Record<string, string | string[]>
  /** The concrete URL the story shows, such as `/stays/42?tab=photos`, for `usePathname()` and `useSearchParams()`. */
  path?: string
}

export type StageParameters = {
  layout?: "centered" | "padded" | "fullscreen"
  viewport?: Viewport
  theme?: "light" | "dark"
  background?: string
  page?: PageParameters
  variants?: Record<string, string>
  [key: string]: unknown
}

export type StoryContext<Args = Record<string, unknown>> = {
  id: string
  title: string
  name: string
  args: Args
  parameters: StageParameters
}

export type Decorator<Args = Record<string, unknown>> = (
  Story: ComponentType,
  context: StoryContext<Args>,
) => ReactNode

type PropsOf<C> = C extends ComponentType<infer P> ? P : Record<string, unknown>

export type Meta<C = ComponentType<any>> = {
  title?: string
  component?: C
  args?: Partial<PropsOf<C>>
  parameters?: StageParameters
  decorators?: Decorator<PropsOf<C>>[]
  tags?: string[]
}

export type Story<C = ComponentType<any>> = {
  name?: string
  args?: Partial<PropsOf<C>>
  parameters?: StageParameters
  decorators?: Decorator<PropsOf<C>>[]
  render?: (args: PropsOf<C>, context: StoryContext<PropsOf<C>>) => ReactNode
  tags?: string[]
}

export type StoryEntry = {
  id: string
  title: string
  name: string
  exportName: string
  file: string
  page?: PageParameters
  /** The frame the story renders in, from its own or its meta's `parameters.viewport`. */
  viewport?: Viewport
  /** Its own or its meta's `parameters.layout`, when written as a string. */
  layout?: StageParameters["layout"]
}

export type StoryIndex = {
  stories: StoryEntry[]
}

export function kebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

export function storyNameFromExport(exportName: string): string {
  return exportName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim()
}

export function toStoryId(title: string, exportName: string): string {
  return `${kebab(title)}--${kebab(exportName)}`
}

export function titleFromPath(relativeFile: string): string {
  const withoutExt = relativeFile.replace(/\.stories\.[cm]?[jt]sx?$/, "")
  const parts = withoutExt.split("/").filter((p) => p && p !== "src" && p !== "components" && p !== "app")
  const deduped = parts.filter((p, i) => i === 0 || p !== parts[i - 1])
  if (deduped.length > 1 && deduped[deduped.length - 1] === "index") deduped.pop()
  return deduped
    .map((p) => p.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join("/")
}
