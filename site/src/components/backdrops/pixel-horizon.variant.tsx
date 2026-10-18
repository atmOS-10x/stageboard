import { useCanvasLoop } from "../hero-backdrop"
import { shade } from "../pixel-waves"

export const variant = {
  of: "landing.hero-backdrop",
  label: "Pixel horizon",
  description: "A perspective floor of pixels under the headline, with swells rolling toward the viewer. Leans toward the pointer.",
}

const ROWS = 70
const COLS = 140

export default function PixelHorizon() {
  let lean = 0

  const ref = useCanvasLoop(({ ctx, w, h, t, pointer }) => {
    const horizon = h * (w < 640 ? 0.34 : 0.3)
    const cx = w / 2
    const target = pointer.active ? (pointer.x / w - 0.5) * 2 : Math.sin(t * 0.00025) * 0.3
    lean += (target - lean) * 0.04
    const f = h * 0.9
    // Far rows first, so near squares draw on top.
    for (let r = ROWS - 1; r >= 0; r--) {
      const z = 1 + r * 0.28
      const worldZ = z + ((t * 0.0008) % 0.28)
      const y = horizon + f / worldZ
      if (y > h + 20) continue
      for (let c = 0; c < COLS; c++) {
        const wx = (c - COLS / 2 + 0.5) * 0.36 + lean * worldZ * 0.6
        const x = cx + (wx * f * 0.55) / worldZ
        if (x < -20 || x > w + 20) continue
        const swell = Math.exp(-Math.pow(((worldZ - t * 0.003) % 6 + 6) % 6 - 3, 2) * 1.2)
        const ripple = 0.5 + 0.5 * Math.sin(wx * 0.9 + worldZ * 1.7 - t * 0.0016)
        const v = Math.min(1, 0.15 + 0.55 * swell + 0.25 * ripple * swell + 0.1 * ripple)
        const size = Math.max(1.2, (16 / worldZ) * (0.4 + 0.6 * v))
        ctx.globalAlpha = Math.min(1, (0.3 + 0.7 * v) * Math.min(1, 9 / worldZ))
        ctx.fillStyle = shade(0.3 + 0.7 * v)
        ctx.fillRect(x - size / 2, y - size / 2 - swell * (30 / worldZ), size, size)
      }
    }
    // A soft glow on the horizon line.
    const g = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 40)
    g.addColorStop(0, "rgba(141,122,246,0)")
    g.addColorStop(0.5, "rgba(141,122,246,0.3)")
    g.addColorStop(1, "rgba(141,122,246,0)")
    ctx.globalAlpha = 1
    ctx.fillStyle = g
    ctx.fillRect(0, horizon - 40, w, 80)
  }, 50)

  return (
    <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_35%,#000_40%,transparent_85%)]">
      <canvas ref={ref} className="block size-full" aria-hidden="true" />
    </div>
  )
}
