import { useMemo, type DragEvent, type ReactNode } from "react"
import { DEVICES, type Device, type PageParameters } from "stageboard"
import { AnnotationLayer, type Surface } from "./annotate"
import { Thumb } from "./thumb"
import type { ClientEntry } from "./types"

export type ScreenNode = { entry: ClientEntry; page: PageParameters }

export const STORY_MIME = "application/x-stageboard-story"

export function screenTitle(s: ScreenNode | undefined, entry?: ClientEntry): string {
  if (s) return s.page.title ?? s.entry.name
  return entry ? entry.name : "Missing screen"
}

export function dragStory(id: string) {
  return (e: DragEvent) => {
    e.dataTransfer.setData(STORY_MIME, id)
    e.dataTransfer.effectAllowed = "copyMove"
  }
}

export function ScreenCard({
  entry,
  title,
  subtitle,
  device,
  thumbUrl,
  surface,
  onOpen,
  badge,
  overlay,
}: {
  entry: ClientEntry
  title: string
  subtitle?: string
  device: Device
  thumbUrl: (id: string) => string
  surface: Surface
  onOpen: () => void
  badge?: ReactNode
  overlay?: ReactNode
}) {
  const d = DEVICES[device]
  return (
    <div className="sbu-card-screen" data-device={device}>
      <div className="sbu-shot" style={{ aspectRatio: `${d.width} / ${d.height}` }} onClick={onOpen} draggable onDragStart={dragStory(entry.id)} title="Open · drag into a flow">
        <Thumb src={thumbUrl(entry.id)} />
        <AnnotationLayer surface={surface} viewport={{ width: d.width, height: d.height }} />
        {overlay}
      </div>
      <div className="sbu-card-caption">
        <span className="sbu-card-title">{title}</span>
        {badge}
        {subtitle && <span className="sbu-card-sub">{subtitle}</span>}
      </div>
    </div>
  )
}

export function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const out = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    if (!out.has(k)) out.set(k, [])
    out.get(k)!.push(item)
  }
  return [...out]
}

export function screenGroup(s: ScreenNode): string {
  return s.page.group ?? s.entry.title.split("/").slice(-1)[0]
}

export function componentGroup(e: ClientEntry): string {
  return e.title
}

export function Grid({
  sections,
  device,
  render,
}: {
  sections: [string, ClientEntry[]][]
  device: Device
  render: (entry: ClientEntry) => ReactNode
}) {
  return (
    <div className="sbu-browse" data-device={device}>
      {sections.map(([name, entries]) => (
        <section key={name} className="sbu-browse-section" id={`sec-${name}`}>
          <h2 className="sbu-browse-title">
            {name} <span className="sbu-dim">{entries.length}</span>
          </h2>
          <div className="sbu-grid">{entries.map(render)}</div>
        </section>
      ))}
    </div>
  )
}

export function useSurfaces(entries: ClientEntry[], prefix: string, title: (e: ClientEntry) => string, url: (id: string) => string) {
  return useMemo(
    () => new Map(entries.map((e): [string, Surface] => [e.id, { key: `${prefix}:${e.id}`, storyId: e.id, title: title(e), url: url(e.id) }])),
    [entries, prefix, title, url],
  )
}
