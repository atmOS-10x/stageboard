import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { selectVariant, submitChangeRequest, useStageboard, type SketchApi } from "@atmos.build/stageboard/react"
import { ORIGINAL, type Region } from "@atmos.build/stageboard"
import { useScrollSync, type Surface } from "./annotate"
import { CheckIcon, PlusIcon } from "./icons"
import { Button } from "./kit"
import { Shimmer } from "./shimmer"
import { errorText, pushToast } from "./toasts"

type Box = { id: string; rect: Region }

function same(a: Box[], b: Box[]) {
  return a.length === b.length && a.every((x, i) => x.id === b[i].id && JSON.stringify(x.rect) === JSON.stringify(b[i].rect))
}

// Yellow outlines around every variant boundary on the live screen; clicking one picks a variant in place.
export function VariantLayer({
  surface,
  visible,
  onCount,
  onAskMore,
}: {
  surface: Surface
  visible: boolean
  onCount?: (n: number) => void
  onAskMore?: (box: Box) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [open, setOpen] = useState<{ box: Box; anchor: DOMRect }>()
  const variants = useStageboard((s) => s.serverVariants)
  const selections = useStageboard((s) => s.selections)
  const jobs = useStageboard((s) => s.jobs)
  useScrollSync(surface.frame, host, layer, undefined, visible)

  useEffect(() => {
    const read = () => {
      try {
        const api = (surface.frame?.()?.contentWindow as (Window & { __stageboard_sketch?: SketchApi }) | null)?.__stageboard_sketch
        const next = api?.boundaries?.() ?? []
        setBoxes((cur) => (same(cur, next) ? cur : next))
      } catch {}
    }
    read()
    const t = setInterval(read, visible ? 400 : 1500)
    return () => clearInterval(t)
  }, [surface, visible])

  const pendingFor = (id: string) =>
    jobs.filter((j) => (j.status === "queued" || j.status === "running") && j.kind === "variants" && j.variantId === id).reduce((n, j) => n + Math.max(0, j.count - j.producedFiles.length), 0)
  const shown = boxes.filter((b) => variants.some((v) => v.of === b.id) || pendingFor(b.id) > 0)
  const ids = [...new Set(shown.map((b) => b.id))]
  const countRef = useRef(onCount)
  countRef.current = onCount
  useEffect(() => countRef.current?.(ids.length), [ids.length])

  useEffect(() => {
    if (!visible) setOpen(undefined)
  }, [visible])

  const adopting = (id: string) => jobs.some((j) => (j.status === "queued" || j.status === "running") && j.kind === "adopt" && j.variantId === id)

  // Adopting asks the agent to make the picked variant the new original; its pin sits on the boundary.
  const adopt = async (box: Box, key: string) => {
    const win = surface.frame?.()?.contentWindow
    const name = variants.find((v) => v.of === box.id && v.key === key)?.label ?? key
    try {
      await submitChangeRequest({
        kind: "adopt",
        note: "",
        adoptKey: key,
        target: {
          url: surface.url,
          title: surface.title,
          selector: "",
          tag: "region",
          rect: box.rect,
          viewport: { width: win?.innerWidth ?? 1440, height: win?.innerHeight ?? 900 },
          components: [],
          storyId: surface.storyId,
          region: box.rect,
          variantId: box.id,
          variantKeys: { [box.id]: key },
        },
      })
      setOpen(undefined)
      pushToast({ tone: "info", title: "Sent to the agent", body: `“${name}” becomes the original of ${box.id}.` })
    } catch (e) {
      pushToast({ tone: "error", title: "Couldn’t adopt the variant", body: errorText(e) })
    }
  }

  const label = (id: string) => {
    const key = selections[id] ?? ORIGINAL
    return key === ORIGINAL ? "Original" : (variants.find((v) => v.of === id && v.key === key)?.label ?? key)
  }

  return (
    <div ref={host} className="sbu-vlayer" data-visible={visible}>
      <div ref={layer} className="sbu-annot-layer">
        {visible &&
          shown.map((b, i) => (
            <button
              key={`${b.id}-${i}`}
              type="button"
              className="sbu-vbox"
              data-open={open?.box.id === b.id}
              data-inside={b.rect.y < 22}
              style={{ left: b.rect.x, top: b.rect.y, width: b.rect.width, height: b.rect.height }}
              onClick={(e) => setOpen(open?.box.id === b.id ? undefined : { box: b, anchor: e.currentTarget.getBoundingClientRect() })}
              title={`${b.id}: choose a variant`}
            >
              <span className="sbu-vbox-label">
                {b.id} · {label(b.id)}
              </span>
            </button>
          ))}
      </div>
      {open &&
        createPortal(
          <VariantMenu
            id={open.box.id}
            anchor={open.anchor}
            selected={selections[open.box.id] ?? ORIGINAL}
            options={variants.filter((v) => v.of === open.box.id)}
            pending={pendingFor(open.box.id)}
            onPick={(key) => void selectVariant(open.box.id, key)}
            adopting={adopting(open.box.id)}
            onAdopt={(key) => void adopt(open.box, key)}
            onAskMore={
              onAskMore &&
              (() => {
                onAskMore(open.box)
                setOpen(undefined)
              })
            }
            onClose={() => setOpen(undefined)}
          />,
          document.body,
        )}
    </div>
  )
}

function VariantMenu({
  id,
  anchor,
  selected,
  options,
  pending,
  onPick,
  adopting,
  onAdopt,
  onAskMore,
  onClose,
}: {
  id: string
  anchor: DOMRect
  selected: string
  options: { key: string; label: string; description?: string }[]
  pending: number
  onPick: (key: string) => void
  adopting?: boolean
  onAdopt?: (key: string) => void
  onAskMore?: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element
      if (!ref.current?.contains(t) && !t.closest?.(".sbu-vbox")) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("pointerdown", onDown, true)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onDown, true)
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])
  const width = 300
  const left = Math.max(12, Math.min(innerWidth - width - 12, anchor.left))
  const below = anchor.bottom + 8
  const top = below + 320 > innerHeight ? Math.max(12, anchor.top - 8 - 320) : below
  const all = [{ key: ORIGINAL, label: "Original", description: "What’s in the code today" }, ...options]
  return (
    <div ref={ref} className="sbu-vmenu sbu-panel" style={{ left, top, width }} role="menu" aria-label={`Variants of ${id}`}>
      <div className="sbu-vmenu-head">{id}</div>
      {all.map((o) => (
        <button key={o.key} type="button" role="menuitemradio" aria-checked={selected === o.key} className="sbu-vmenu-item" data-on={selected === o.key} onClick={() => onPick(o.key)}>
          <span className="sbu-vmenu-text">
            <span className="sbu-vmenu-label">{o.label}</span>
            {o.description && <span className="sbu-vmenu-desc">{o.description}</span>}
          </span>
          {selected === o.key && <CheckIcon size={14} />}
        </button>
      ))}
      {pending > 0 && (
        <div className="sbu-vmenu-pending">
          <Shimmer>{`${pending} more being made…`}</Shimmer>
        </div>
      )}
      {onAdopt && selected !== ORIGINAL && options.some((o) => o.key === selected) && (
        <Button size="sm" variant="solid" icon={<CheckIcon size={13} />} className="sbu-vmenu-adopt" disabled={adopting} onClick={() => onAdopt(selected)}>
          {adopting ? "Adopting…" : "Adopt as original"}
        </Button>
      )}
      {onAskMore && (
        <Button size="sm" variant="ghost" icon={<PlusIcon size={13} />} className="sbu-vmenu-more" onClick={onAskMore}>
          Ask for more variants
        </Button>
      )}
    </div>
  )
}
