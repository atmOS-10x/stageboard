import { useEffect, useState, type RefObject } from "react"
import { withQuery } from "./api"
import { Shimmer } from "./shimmer"
import { WaveCanvas } from "./waves"

/** True once the element has come near the viewport (or its scrolling row), and from then on. */
export function useSeen(ref: RefObject<Element | null>, margin = "300px"): boolean {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setSeen(true), { rootMargin: margin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, margin, seen])
  return seen
}

// The colour of an image's top-left pixel: what a frame's page is painted with, to fill the space around it.
function cornerColor(img: HTMLImageElement): string | undefined {
  try {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `rgb(${r}, ${g}, ${b})`
  } catch {
    return undefined
  }
}

export function Thumb({ src, className, onColor }: { src: string; className?: string; onColor?: (color: string) => void }) {
  const [retry, setRetry] = useState(0)
  const requested = retry ? withQuery(src, { refresh: 1, r: retry }) : src
  const [shown, setShown] = useState<string>()
  const [failed, setFailed] = useState<string>()

  useEffect(() => setRetry(0), [src])

  const loading = shown !== requested && failed !== requested
  const broken = failed === requested && !shown

  return (
    <div className={`sbu-thumb ${className ?? ""}`} data-state={shown ? "ready" : broken ? "error" : "loading"} data-stale={Boolean(shown && loading) || undefined}>
      {shown && <img className="sbu-thumb-img" src={shown} alt="" draggable={false} />}
      {shown !== requested && failed !== requested && (
        <img
          key={requested}
          className="sbu-thumb-img"
          data-incoming="true"
          src={requested}
          alt=""
          draggable={false}
          onLoad={(e) => {
            setShown(requested)
            const color = onColor && cornerColor(e.currentTarget)
            if (color) onColor!(color)
          }}
          onError={() => setFailed(requested)}
        />
      )}
      {/* A new look (theme, device, variant) is rendering: keep the old image, dimmed, and say so. */}
      {shown && loading && (
        <span className="sbu-thumb-note" data-on-waves="true">
          <Shimmer>Rendering</Shimmer>
        </span>
      )}
      {!shown && loading && (
        <>
          <WaveCanvas mode="render" fps={24} />
          <span className="sbu-thumb-note" data-on-waves="true">
            <Shimmer>Rendering</Shimmer>
          </span>
        </>
      )}
      {broken && (
        <span className="sbu-thumb-note" data-error="true">
          Couldn’t render
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setRetry(Date.now())
            }}
          >
            Retry
          </button>
        </span>
      )}
    </div>
  )
}
