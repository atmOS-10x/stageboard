import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react"
import { componentFrame, DEVICES, type Device, type PageParameters } from "stageboard"
import { AnnotationLayer, type Surface } from "./annotate"
import { Thumb, useSeen } from "./thumb"
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
      <div className="sbu-shot" style={{ aspectRatio: `${d.width} / ${d.height}` }} onClick={onOpen} draggable onDragStart={dragStory(entry.id)} title={subtitle ? `${subtitle} · drag into a flow` : "Open · drag into a flow"}>
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
            {name.replaceAll("/", " / ")} <span className="sbu-dim">{entries.length}</span>
          </h2>
          <div className="sbu-grid">{entries.map(render)}</div>
        </section>
      ))}
    </div>
  )
}

/** The 16:9 tile every component shows in, whatever frame it renders in. */
export const TILE = 16 / 9

export type Frame = { width: number; height: number }

export function frameOf(entry: ClientEntry): Frame {
  return componentFrame(entry.viewport, entry.layout)
}

/** The frame fitted into a 16:9 tile: full width when it is wider than the tile, full height otherwise. */
export function fitStyle(frame: Frame): CSSProperties {
  const wide = frame.width / frame.height >= TILE
  return { aspectRatio: `${frame.width} / ${frame.height}`, ...(wide ? { width: "100%" } : { height: "100%" }) }
}

// A component story in its own frame, fitted into the same 16:9 tile as the others, so a small button is as easy
// to see as a whole panel. Nothing renders or loads until the tile comes near the screen.
export function ComponentCard({
  entry,
  thumbUrl,
  surface,
  onOpen,
}: {
  entry: ClientEntry
  thumbUrl: (id: string, frame: Frame) => string
  surface: Surface
  onOpen: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useSeen(ref)
  const frame = frameOf(entry)
  // The tile around the frame takes the colour of the frame's own page, so the two read as one surface.
  const [paper, setPaper] = useState<string>()
  return (
    <div className="sbu-tile" ref={ref}>
      <div className="sbu-shot sbu-tile-shot" style={paper ? { background: paper } : undefined} onClick={onOpen} title={`${entry.name} · ${frame.width}×${frame.height}`} role="button" aria-label={entry.name}>
        {seen && (
          <div className="sbu-tile-fit" style={fitStyle(frame)}>
            <Thumb src={thumbUrl(entry.id, frame)} onColor={setPaper} />
            <AnnotationLayer surface={surface} viewport={frame} />
          </div>
        )}
      </div>
      <div className="sbu-card-caption">
        <span className="sbu-card-title">{entry.name}</span>
        <span className="sbu-card-sub">
          {frame.width}×{frame.height}
        </span>
      </div>
    </div>
  )
}

// One row per component, like a flow: its title, then all its stories side by side, scrolling sideways.
export function ComponentRows({
  sections,
  focus,
  render,
  onOpenGroup,
}: {
  sections: [string, ClientEntry[]][]
  focus?: string
  render: (entry: ClientEntry, group: string, index: number) => ReactNode
  onOpenGroup: (group: string) => void
}) {
  // Back from a component's viewer, or picked in the sidebar: bring its row into view.
  useEffect(() => {
    if (focus) document.getElementById(`comp-${focus}`)?.scrollIntoView({ block: "nearest" })
  }, [focus])
  return (
    <div className="sbu-browse sbu-comps">
      {sections.map(([name, entries]) => {
        const parts = name.split("/")
        return (
          <section key={name} className="sbu-flow sbu-comp-group" id={`comp-${name}`} data-focus={focus === name}>
            <div className="sbu-comp-head">
              <h2 className="sbu-flow-name" onClick={() => onOpenGroup(name)} title="Open, then ← → through its stories">
                {parts.length > 1 && <span className="sbu-dim">{parts.slice(0, -1).join(" / ")} / </span>}
                {parts.at(-1)}
              </h2>
              <span className="sbu-dim">{entries.length}</span>
            </div>
            <div className="sbu-flow-row">{entries.map((e, i) => render(e, name, i))}</div>
          </section>
        )
      })}
    </div>
  )
}

export function useSurfaces(entries: ClientEntry[], prefix: string, title: (e: ClientEntry) => string, url: (id: string) => string) {
  return useMemo(
    () => new Map(entries.map((e): [string, Surface] => [e.id, { key: `${prefix}:${e.id}`, storyId: e.id, title: title(e), url: url(e.id) }])),
    [entries, prefix, title, url],
  )
}
