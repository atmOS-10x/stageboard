import type { ComponentType, ReactNode } from "react"

export type Viewport = { width: number; height?: number }

export type PageParameters = {
  route: string
  title?: string
  links?: string[]
  group?: string
  dream?: string
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
