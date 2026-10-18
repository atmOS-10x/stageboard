import { useEffect, useRef } from "react"

// The pixel ocean stageboard shows while an agent builds a screen (packages/stageboard/src/client/waves.tsx),
// with a configurable cell size and an optional transparent sea so it can sit on the page.

type RGB = [number, number, number]

const DEEP: RGB = [22, 21, 30]
const SWELL: RGB = [74, 62, 150]
const CREST: RGB = [150, 132, 255]
const FOAM: RGB = [236, 233, 255]

function mix(a: RGB, b: RGB, t: number): string {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`
}

export function shade(v: number): string {
  if (v < 0.45) return mix(DEEP, SWELL, v / 0.45)
  if (v < 0.9) return mix(SWELL, CREST, (v - 0.45) / 0.45)
  return mix(CREST, FOAM, (v - 0.9) / 0.1)
}

// A breaking-wave profile over one wavelength: a steep face, a bright crest, a long soft back.
function profile(p: number): number {
  const f = p - Math.floor(p)
  return f < 0.2 ? Math.pow(f / 0.2, 1.6) : Math.exp(-(f - 0.2) * 1.5)
}

type Train = { dx: number; dy: number; length: number; speed: number; wobble: number; weight: number }

const TRAINS: Train[] = [
  { dx: 0.92, dy: 0.38, length: 0.42, speed: 0.00035, wobble: 0.05, weight: 1 },
  { dx: 0.7, dy: -0.71, length: 0.3, speed: 0.00022, wobble: 0.06, weight: 0.32 },
]

function height(x: number, y: number, w: number, t: number): number {
  let top = 0
  let sum = 0
  for (const tr of TRAINS) {
    const along = (x * tr.dx + y * tr.dy) / (w * tr.length)
    const across = (-x * tr.dy + y * tr.dx) / w
    const h = profile(along - t * tr.speed + tr.wobble * Math.sin(across * 4 + t * 0.0006)) * tr.weight
    top = Math.max(top, h)
    sum += h
  }
  return Math.min(1, top + (sum - top) * 0.3)
}

export type PixelWavesProps = {
  className?: string
  /** "reveal" washes one wave over the box and leaves it dry behind the front, then calls onDone. */
  mode?: "render" | "reveal"
  onDone?: () => void
  cell?: number
  /** Fill the sea with the deep colour; off lets the page show between the pixels. */
  sea?: boolean
  fps?: number
  /** Scales every pixel's opacity, for quiet backgrounds. */
  intensity?: number
}

const REVEAL_MS = 1500

export function PixelWaves({ className, mode = "render", onDone, cell = 10, sea = true, fps = 60, intensity = 1 }: PixelWavesProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    const start = performance.now() - (mode === "render" ? Math.random() * 6000 : 0)
    const frameMs = 1000 / fps - 2
    let raf = 0
    let last = 0
    let visible = true
    const io = new IntersectionObserver(([entry]) => {
      const was = visible
      visible = entry.isIntersecting
      if (visible && !was) raf = requestAnimationFrame(draw)
    })
    io.observe(canvas)

    const draw = (now: number) => {
      if (!visible && mode === "render") return
      if (mode === "render" && last && now - last < frameMs) {
        raf = requestAnimationFrame(draw)
        return
      }
      last = now
      const dpr = devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const ctx = canvas.getContext("2d")!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const t = reduce ? 0 : now - start
      const reveal = mode === "reveal" ? Math.min(1, reduce ? 1 : t / REVEAL_MS) : 0
      if (sea && mode === "render") {
        ctx.fillStyle = shade(0)
        ctx.fillRect(0, 0, w, h)
      }
      const cols = Math.ceil(w / cell)
      const rows = Math.ceil(h / cell)
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * cell + cell / 2
          const y = j * cell + cell / 2
          let v = height(x, y, w, t)
          if (mode === "reveal") {
            const front = reveal * (w * 1.5) - w * 0.25 + 0.06 * w * Math.sin((y / h) * 6 + reveal * 5) - (y / h) * w * 0.15
            const d = x - front
            if (d < 0) continue
            ctx.globalAlpha = 1
            ctx.fillStyle = shade(0)
            ctx.fillRect(x - cell / 2, y - cell / 2, cell, cell)
            v = Math.max(v, Math.exp(-d / (w * 0.06)))
          }
          const size = cell * (0.42 + 0.5 * v)
          ctx.globalAlpha = (0.35 + 0.65 * v) * intensity
          ctx.fillStyle = shade(v)
          ctx.fillRect(x - size / 2, y - size / 2, size, size)
        }
      }
      ctx.globalAlpha = 1
      if (mode === "reveal" && reveal >= 1) {
        done.current?.()
        return
      }
      if (!reduce || mode === "reveal") raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [mode, cell, sea, fps, intensity])

  return <canvas ref={ref} className={`block h-full w-full ${className ?? ""}`} aria-hidden="true" />
}
