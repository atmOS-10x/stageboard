import { useEffect, useRef } from "react"
import { variant } from "stageboard/react"
import { PixelWaves } from "./pixel-waves"

// The hero's backdrop: a canvas behind the headline and the Flows demo. It's its own variant point
// (landing.hero-backdrop) so the visualization can be swapped without touching the hero; the alternatives live in
// components/backdrops/*.variant.tsx.

export type Pointer = { x: number; y: number; active: boolean; moved: number }
export type Frame = { ctx: CanvasRenderingContext2D; w: number; h: number; t: number; dt: number; pointer: Pointer; reduce: boolean }

/** A full-size canvas redrawn every frame while on screen. The pointer comes from the window, so the canvas can
 * sit behind content and stay pointer-events: none. */
export function useCanvasLoop(draw: (f: Frame) => void, fps = 50) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    const pointer: Pointer = { x: -1e4, y: -1e4, active: false, moved: 0 }
    const start = performance.now()
    const frameMs = 1000 / fps - 2
    let raf = 0
    let last = 0
    let visible = true

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      pointer.x = e.clientX - r.left
      pointer.y = e.clientY - r.top
      pointer.active = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= r.width && pointer.y <= r.height
      pointer.moved = performance.now() - start
    }
    const onLeave = () => (pointer.active = false)
    addEventListener("pointermove", onMove, { passive: true })
    document.addEventListener("pointerleave", onLeave)

    const io = new IntersectionObserver(([entry]) => {
      const was = visible
      visible = entry.isIntersecting
      if (visible && !was) raf = requestAnimationFrame(frame)
    })
    io.observe(canvas)

    const frame = (now: number) => {
      if (!visible) return
      if (last && now - last < frameMs) {
        raf = requestAnimationFrame(frame)
        return
      }
      const dt = last ? now - last : 16
      last = now
      const dpr = Math.min(devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const ctx = canvas.getContext("2d")!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      drawRef.current({ ctx, w, h, t: reduce ? 4000 : now - start, dt, pointer, reduce })
      ctx.globalAlpha = 1
      if (!reduce) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerleave", onLeave)
    }
  }, [fps])

  return ref
}

/** Original: the pixel ocean rolling in behind the Flows demo. */
function PixelTide() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[34%] bottom-0 [mask-image:radial-gradient(ellipse_70%_75%_at_50%_50%,#000_30%,transparent_75%)]">
      <PixelWaves cell={12} sea={false} intensity={0.55} fps={40} />
    </div>
  )
}

export const HeroBackdrop = variant("landing.hero-backdrop", PixelTide)
