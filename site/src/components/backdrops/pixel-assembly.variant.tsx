import { useRef } from "react"
import { useCanvasLoop } from "../hero-backdrop"
import { shade } from "../pixel-waves"

export const variant = {
  of: "landing.hero-backdrop",
  label: "Pixels into screens",
  description: "Loose pixels drift in, snap into wireframe screens flanking the headline, hold, then wash away and rebuild.",
}

const CELL = 7
const CYCLE = 8000

type Px = { tx: number; ty: number; sx: number; sy: number; v: number; delay: number }

// One wireframe screen, in cells: outline, a nav bar, a photo block and text lines.
function screen(ox: number, oy: number, cw: number, ch: number, kind: number): Omit<Px, "sx" | "sy" | "delay">[] {
  const out: Omit<Px, "sx" | "sy" | "delay">[] = []
  const add = (x: number, y: number, v: number) => out.push({ tx: ox + x * CELL, ty: oy + y * CELL, v })
  for (let x = 0; x < cw; x++) {
    add(x, 0, 0.75)
    add(x, ch - 1, 0.75)
    if (x > 0 && x < cw - 1) add(x, 2, 0.4)
  }
  for (let y = 1; y < ch - 1; y++) {
    add(0, y, 0.75)
    add(cw - 1, y, 0.75)
  }
  add(2, 1, 1)
  const photo = kind % 2 === 0 ? { x: 2, y: 4, w: Math.floor(cw * 0.55), h: Math.floor(ch * 0.45) } : { x: 2, y: 4, w: cw - 4, h: Math.floor(ch * 0.32) }
  for (let x = 0; x < photo.w; x++) for (let y = 0; y < photo.h; y++) add(photo.x + x, photo.y + y, 0.35 + 0.5 * ((x + y) % 3 === 0 ? 1 : 0.4))
  const textTop = photo.y + photo.h + 2
  for (let line = 0; line < 3 && textTop + line * 2 < ch - 2; line++) {
    const len = Math.floor((cw - 4) * [0.7, 0.9, 0.5][line])
    for (let x = 0; x < len; x++) add(2 + x, textTop + line * 2, line === 0 ? 0.85 : 0.45)
  }
  if (kind === 1) for (let x = 0; x < 8; x++) add(cw - 10 + x, ch - 3, 1)
  return out
}

function layout(w: number, h: number): Px[] {
  const phone = w < 640
  const cw = phone ? 14 : 26
  const ch = phone ? 26 : 17
  const sw = cw * CELL
  const sh = ch * CELL
  const spots: [number, number][] = phone
    ? [[w * 0.02, h * 0.05], [w - sw - w * 0.02, h * 0.05]]
    : [[w * 0.04, h * 0.1], [w * 0.1, h * 0.1 + sh + 46], [w * 0.96 - sw, h * 0.1], [w * 0.9 - sw, h * 0.1 + sh + 46]]
  const all = spots.flatMap(([x, y], k) => screen(x, y, cw, ch, k))
  // The flow arrows between stacked screens.
  if (!phone)
    for (const [x, y] of [spots[0], spots[2]])
      for (let k = 0; k < 6; k++) all.push({ tx: x + sw / 2, ty: y + sh + 4 + k * CELL, v: 0.9 })
  return all.map((p) => ({ ...p, sx: Math.random() * w, sy: h * (0.2 + Math.random() * 0.8), delay: Math.random() * 900 }))
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)

export default function PixelAssembly() {
  const state = useRef<{ w: number; h: number; px: Px[]; loop: number }>({ w: 0, h: 0, px: [], loop: -1 })

  const ref = useCanvasLoop(({ ctx, w, h, t }) => {
    const s = state.current
    const loop = Math.floor(t / CYCLE)
    if (s.w !== w || s.h !== h || s.loop !== loop) Object.assign(s, { w, h, px: layout(w, h), loop })
    const c = t % CYCLE
    for (const p of s.px) {
      // In: 0–2.6s, hold to 5.4s, out: wash to the right and down.
      const into = ease((c - p.delay) / 1700)
      const out = ease((c - 5400 - p.delay * 0.6) / 1600)
      const wave = Math.sin(p.tx * 0.012 + t * 0.002) * 4
      const x = p.sx + (p.tx - p.sx) * into + out * (w * 0.25 + p.ty * 0.2)
      const y = p.sy + (p.ty - p.sy) * into + (1 - into) * wave + out * 60
      const settled = into * (1 - out)
      const shimmer = c > 2600 && c < 5400 ? 0.15 * Math.max(0, Math.sin(p.tx * 0.03 - c * 0.006)) : 0
      const v = Math.min(1, p.v * (0.35 + 0.65 * settled) + shimmer)
      const size = CELL * (0.35 + 0.45 * settled)
      ctx.globalAlpha = (0.15 + 0.6 * v) * (1 - out * 0.9) * Math.min(1, c / 300)
      ctx.fillStyle = shade(0.4 + 0.6 * v)
      ctx.fillRect(x - size / 2, y - size / 2, size, size)
    }
  }, 50)

  return (
    <div className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,#000_50%,transparent_80%)]">
      <canvas ref={ref} className="block size-full" aria-hidden="true" />
    </div>
  )
}
