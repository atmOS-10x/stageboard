import { useCanvasLoop } from "../hero-backdrop"
import { shade } from "../pixel-waves"

export const variant = {
  of: "landing.hero-backdrop",
  label: "Ripple field",
  description: "A dot-matrix field behind the whole hero. The pointer sends ripples through it; when idle it ripples on its own.",
}

const CELL = 14

type Ripple = { x: number; y: number; t0: number; power: number }

export default function RippleField() {
  const ripples: Ripple[] = []
  let lastDrop = 0
  let lastAuto = -1e9

  const ref = useCanvasLoop(({ ctx, w, h, t, pointer }) => {
    // Ripples from the pointer while it moves, and every so often on their own.
    if (pointer.active && t - pointer.moved < 60 && t - lastDrop > 140) {
      ripples.push({ x: pointer.x, y: pointer.y, t0: t, power: 0.8 })
      lastDrop = t
    }
    if (t - lastAuto > 1700 && (!pointer.active || t - pointer.moved > 2500)) {
      ripples.push({ x: w * (0.15 + Math.random() * 0.7), y: h * (0.08 + Math.random() * 0.4), t0: t, power: 1 })
      lastAuto = t
    }
    while (ripples.length && t - ripples[0].t0 > 2600) ripples.shift()

    const cols = Math.ceil(w / CELL)
    const rows = Math.ceil(h / CELL)
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * CELL + CELL / 2
        const y = j * CELL + CELL / 2
        let v = 0.2 + 0.1 * Math.sin(i * 0.37 + t * 0.0011) * Math.sin(j * 0.29 - t * 0.0008)
        for (const r of ripples) {
          const age = t - r.t0
          const d = Math.hypot(x - r.x, y - r.y)
          v += r.power * Math.exp(-Math.abs(d - age * 0.3) / 22) * Math.exp(-age / 1300)
        }
        if (pointer.active) v += 0.5 * Math.exp(-Math.hypot(x - pointer.x, y - pointer.y) / 70)
        v = Math.min(1, v)
        const size = CELL * (0.2 + 0.5 * v)
        ctx.globalAlpha = 0.25 + 0.75 * v
        ctx.fillStyle = shade(0.35 + 0.65 * v)
        ctx.fillRect(x - size / 2, y - size / 2, size, size)
      }
    }
  }, 45)

  return (
    <div className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,#000_55%,transparent_92%)]">
      <canvas ref={ref} className="block size-full" aria-hidden="true" />
    </div>
  )
}
