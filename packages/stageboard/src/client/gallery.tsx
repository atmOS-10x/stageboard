import { useMemo } from "react"
import { selectVariant, useStageboard } from "stageboard/react"
import { ORIGINAL, type VariantFile } from "stageboard"
import { AnnotationLayer, isActive, type Surface } from "./annotate"
import { withQuery } from "./api"
import { CheckIcon } from "./icons"
import { Thumb } from "./thumb"

const VIEWPORT = { width: 1440, height: 900 }

type Card = { key: string; label: string; description?: string }

export function Gallery({
  storyId,
  title,
  used,
  base,
  frameUrl,
  selectionKey,
}: {
  storyId: string
  title: string
  used?: string[]
  base: string
  frameUrl: string
  selectionKey: string
}) {
  const variants = useStageboard((s) => s.serverVariants)
  const rows = useMemo(() => {
    const byId = new Map<string, VariantFile[]>()
    for (const v of variants) byId.set(v.of, [...(byId.get(v.of) ?? []), v])
    return (used ?? [])
      .filter((id) => byId.has(id))
      .map((id) => ({ id, variants: byId.get(id)!.sort((a, b) => a.key.localeCompare(b.key)) }))
  }, [variants, used])

  if (!used) {
    return (
      <div className="sbu-gallery-empty">
        <span className="sbu-spin" />
        Looking for variant boundaries…
      </div>
    )
  }
  if (!rows.length) {
    return (
      <div className="sbu-gallery-empty">
        <div>
          <p className="sbu-gallery-empty-title">No variants in this story yet</p>
          <p>Press A, drag over a section and ask for Variants. They’ll line up here side by side.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="sbu-gallery">
      {rows.map((row) => (
        <GalleryRow key={row.id} id={row.id} variants={row.variants} storyId={storyId} title={title} base={base} frameUrl={frameUrl} selectionKey={selectionKey} />
      ))}
    </div>
  )
}

function GalleryRow({
  id,
  variants,
  storyId,
  title,
  base,
  frameUrl,
  selectionKey,
}: {
  id: string
  variants: VariantFile[]
  storyId: string
  title: string
  base: string
  frameUrl: string
  selectionKey: string
}) {
  const active = useStageboard((s) => s.overrides[id] ?? s.selections[id] ?? ORIGINAL)
  const pending = useStageboard((s) =>
    s.jobs.filter((j) => isActive(j) && j.kind === "variants" && j.variantId === id).reduce((n, j) => n + Math.max(0, j.count - j.producedFiles.length), 0),
  )
  const cards: Card[] = [{ key: ORIGINAL, label: "Original", description: "What’s committed today" }, ...variants]
  return (
    <section className="sbu-row">
      <header className="sbu-row-head">
        <span className="sbu-row-id">{id}</span>
        <span className="sbu-dim">{variants.length + 1} options</span>
      </header>
      <div className="sbu-cards">
        {cards.map((card) => (
          <VariantCard
            key={card.key}
            card={card}
            id={id}
            on={active === card.key}
            storyId={storyId}
            title={title}
            base={base}
            frameUrl={frameUrl}
            selectionKey={selectionKey}
          />
        ))}
        {Array.from({ length: pending }, (_, i) => (
          <div key={`pending-${i}`} className="sbu-card" data-pending="true">
            <div className="sbu-card-shot">
              <div className="sbu-thumb" data-state="loading">
                <span className="sbu-thumb-note">Sketching…</span>
              </div>
            </div>
            <div className="sbu-card-meta">
              <span className="sbu-card-label sbu-dim">New variant</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function VariantCard({
  card,
  id,
  on,
  storyId,
  title,
  base,
  frameUrl,
  selectionKey,
}: {
  card: Card
  id: string
  on: boolean
  storyId: string
  title: string
  base: string
  frameUrl: string
  selectionKey: string
}) {
  const surface = useMemo<Surface>(
    () => ({
      key: `card:${storyId}:${id}:${card.key}`,
      storyId,
      title,
      url: withQuery(frameUrl, { "sb-variant": `${id}:${card.key}` }),
      variant: { id, key: card.key, label: card.label },
    }),
    [storyId, id, card.key, card.label, title, frameUrl],
  )
  const src = withQuery(`${base}/api/thumb/${storyId}.jpg`, { variant: `${id}:${card.key}`, s: selectionKey.slice(0, 200) })
  return (
    <article className="sbu-card" data-on={on}>
      <div className="sbu-card-shot">
        <Thumb src={src} />
        <AnnotationLayer surface={surface} viewport={VIEWPORT} />
      </div>
      <div className="sbu-card-meta">
        <div className="sbu-card-line">
          <span className="sbu-card-label">{card.label}</span>
          <span className="sbu-spacer" />
          {on ? (
            <span className="sbu-card-inuse">
              <CheckIcon size={11} /> In use
            </span>
          ) : (
            <button type="button" className="sbu-ghost sbu-ghost-sm" onClick={() => selectVariant(id, card.key)}>
              Use
            </button>
          )}
        </div>
        {card.description && <p className="sbu-card-desc">{card.description}</p>}
      </div>
    </article>
  )
}
