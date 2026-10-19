import { useLayoutEffect, useRef, useState, type ReactNode, type WheelEvent as RWheelEvent } from "react"
import { NextIcon, PrevIcon } from "./icons"
import { IconButton } from "./kit"

const SWIPE = 70
const GAP = 32
const PRELOAD = 2

export type SlotSize = { w: number; h: number; scale: number }

export function ViewerStage({
  steps,
  step,
  frame,
  busy,
  onStep,
  slot,
}: {
  steps: string[]
  step: number
  frame: { width: number; height: number }
  busy: boolean
  onStep: (index: number) => void
  slot: (index: number, current: boolean, size: SlotSize) => { content: ReactNode; live?: boolean }
}) {
  const stage = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const count = steps.length

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = box.width ? Math.min(1, (box.width * (box.width < 760 ? 0.9 : 0.72)) / frame.width, (box.height - 8) / frame.height) : 0
  const w = frame.width * scale
  const h = frame.height * scale
  const go = (delta: number) => onStep(Math.max(0, Math.min(count - 1, step + delta)))

  // Trackpad swipe: horizontal wheel travel past a threshold moves one screen.
  const wheel = useRef({ dx: 0, at: 0 })
  const onWheel = (e: RWheelEvent) => {
    if (busy || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return
    const now = Date.now()
    if (now - wheel.current.at > 400) wheel.current.dx = 0
    wheel.current.at = now
    wheel.current.dx += e.deltaX
    if (Math.abs(wheel.current.dx) > SWIPE * 2) {
      go(wheel.current.dx > 0 ? 1 : -1)
      wheel.current = { dx: 0, at: now + 400 }
    }
  }
  const touch = useRef<number | undefined>(undefined)

  return (
    <div
      ref={stage}
      className="sbu-viewer-stage"
      onScroll={(e) => e.currentTarget.scrollTo(0, 0)}
      onWheel={onWheel}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const start = touch.current
        touch.current = undefined
        if (start === undefined || busy) return
        const dx = e.changedTouches[0].clientX - start
        if (Math.abs(dx) > SWIPE) go(dx < 0 ? 1 : -1)
      }}
    >
      {scale > 0 && (
        <div className="sbu-viewer-track" style={{ height: h }}>
          {steps.map((key, i) => {
            if (Math.abs(i - step) > PRELOAD) return null
            const current = i === step
            const { content, live } = slot(i, current, { w, h, scale })
            return (
              <div
                key={key}
                className="sbu-viewer-slot"
                data-current={current}
                data-live={current && Boolean(live)}
                style={{ width: w, height: h, transform: `translateX(calc(-50% + ${(i - step) * (w + GAP)}px))` }}
                onClick={current ? undefined : () => onStep(i)}
                aria-hidden={!current}
                ref={(el) => {
                  if (el) el.inert = !current
                }}
              >
                {content}
              </div>
            )
          })}
          {step > 0 && (
            <IconButton size="lg" className="sbu-viewer-nav" style={{ transform: `translateX(calc(-50% - ${w / 2 + GAP / 2}px))` }} icon={<PrevIcon size={22} />} label="Previous · ←" onClick={() => go(-1)} />
          )}
          {step < count - 1 && (
            <IconButton size="lg" className="sbu-viewer-nav" style={{ transform: `translateX(calc(-50% + ${w / 2 + GAP / 2}px))` }} icon={<NextIcon size={22} />} label="Next · →" onClick={() => go(1)} />
          )}
        </div>
      )}
    </div>
  )
}
