import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { ArrowUp, Component, Menu, MessageSquarePlus, MousePointer2, Pen, Plus, Square, Undo2, X } from "lucide-react"
import { BrandMark } from "./brand"
import { AgentStack } from "./copy-prompt"
import {
  BookMachineScreen,
  ReplayScreen,
  SessionScreen,
  PHONE_H,
  PHONE_W,
  PhoneBookMachine,
  PhoneReplay,
  PhoneSession,
  PhonePlugins,
  PhoneSessions,
  SCREEN_H,
  SCREEN_W,
  PluginsScreen,
  Scaled,
  SessionsScreen,
  type BookMachineProps,
} from "./mini-screens"
import { PixelWaves } from "./pixel-waves"

// The two product demos: the Flows page with a flow being assembled, and the flow viewer walking a flow, marking
// it up and reconciling. 16:9 on desktop; on phones they switch to stageboard's mobile layout and phone screens.

export function usePhone() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && matchMedia("(max-width: 639px)").matches)
  useEffect(() => {
    const mq = matchMedia("(max-width: 639px)")
    const on = () => setPhone(mq.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return phone
}

/** Milliseconds into a looping timeline, paused while off screen or with reduced motion (then fixed at `still`). */
function useTimeline(cycle: number, still: number, at?: number) {
  const [t, setT] = useState(at ?? 0)
  useEffect(() => {
    if (at !== undefined) {
      setT(at)
      return
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(still)
      return
    }
    let start = performance.now()
    let paused = 0
    let hidden = false
    const id = setInterval(() => {
      if (hidden) return
      setT((performance.now() - start) % cycle)
    }, 50)
    const vis = () => {
      if (document.hidden) {
        hidden = true
        paused = performance.now()
      } else if (hidden) {
        hidden = false
        start += performance.now() - paused
      }
    }
    document.addEventListener("visibilitychange", vis)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", vis)
    }
  }, [cycle, still, at])
  return t
}

function Device({ phone, children }: { phone: boolean; children: ReactNode }) {
  return phone ? (
    <Scaled width={PHONE_W} height={PHONE_H}>{children}</Scaled>
  ) : (
    <Scaled width={SCREEN_W} height={SCREEN_H}>{children}</Scaled>
  )
}

function Window({ phone, children, className }: { phone: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900 text-[13px] shadow-[0_40px_120px_-20px_rgb(0_0_0/0.8),0_0_0_1px_rgb(0_0_0/0.4)] ${phone ? "aspect-[3/5]" : "aspect-video"} ${className ?? ""}`}
    >
      {children}
    </div>
  )
}

function TopBar({ phone, tab }: { phone: boolean; tab: string }) {
  if (phone)
    return (
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-white/8 bg-ink-800 px-2.5">
        <span className="grid size-8 place-items-center rounded-full text-fg-soft"><Menu className="size-4" /></span>
        <BrandMark className="size-5" />
        <span className="text-[14px] font-medium text-fg">{tab}</span>
        <span className="flex-1" />
        <span className="grid size-8 place-items-center rounded-full bg-[#ebebf0] text-[#16161b]"><MessageSquarePlus className="size-4" /></span>
      </div>
    )
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/8 bg-ink-800 px-3.5">
      <span className="flex w-[176px] items-center gap-2 font-semibold tracking-[-0.01em] text-fg">
        <BrandMark className="size-5" /> stageboard
      </span>
      <nav className="flex h-12 items-stretch gap-5">
        {["Screens", "Flows", "Components"].map((t) => (
          <span key={t} className={`relative flex items-center text-[13px] font-medium ${t === tab ? "text-[#f4f4f7]" : "text-fg-dim"}`}>
            {t}
            {t === tab && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-t bg-[#f4f4f7]" />}
          </span>
        ))}
      </nav>
      <span className="flex-1" />
      <span className="hidden rounded-full bg-white/6 p-0.5 text-[12px] lg:flex">
        {["Desktop", "Tablet", "Mobile"].map((d, i) => (
          <span key={d} className={`rounded-full px-2.5 py-1 ${i === 0 ? "bg-white/12 text-fg" : "text-fg-dim"}`}>{d}</span>
        ))}
      </span>
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#ebebf0] px-3 text-[12px] font-medium text-[#16161b]">
        <MessageSquarePlus className="size-3.5" /> Annotate
      </span>
    </div>
  )
}

function Shot({ children, ring }: { children: ReactNode; ring?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-[8px] bg-ink-750 ${ring ? "shadow-[0_0_0_1px_rgb(150_132_255/0.45)]" : "shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_10px_26px_rgb(0_0_0/0.35)]"}`}>
      {children}
    </div>
  )
}

function FlowsSidebar({ active, busy }: { active: string; busy?: boolean }) {
  return (
    <aside className="w-[176px] shrink-0 border-r border-white/8 bg-ink-850 px-2 pt-3">
      <div className="px-2 py-1 text-[12px] font-medium text-fg-dim">Flows</div>
      {["Run on a cloud machine", "Connect a plugin"].map((name) => (
        <div key={name} className={`flex items-center gap-2 rounded-md px-2 py-1 text-[12.5px] ${name === active ? "bg-accent/16 text-white" : "text-[#a0a0aa]"}`}>
          {name}
          {name === active && busy && <span className="ml-auto size-1.5 animate-pulse rounded-full bg-accent-soft" />}
        </div>
      ))}
      <div className="mt-2 flex items-center gap-1.5 px-2 py-1 text-[12.5px] text-lilac"><Plus className="size-3.5" /> New flow</div>
    </aside>
  )
}

/* ------------------------------------------------------------------ Flows: one flow being assembled */

const FLOWS_CYCLE = 9000

/** `at` freezes the demo at that many milliseconds into its loop, for stories and screenshots. */
export function FlowsDemo({ at }: { at?: number }) {
  const phone = usePhone()
  const t = useTimeline(FLOWS_CYCLE, 7000, at)
  const loop = Math.floor(performance.now() / FLOWS_CYCLE)
  const shown = [t > 500, t > 1100, t > 1700]
  const revealing = t > 4600 && t < 6200
  const built = t > 4600
  const done = t > 6200

  const A = phone ? [PhoneSessions, PhoneSession, PhoneBookMachine, PhoneReplay] : [SessionsScreen, SessionScreen, BookMachineScreen, ReplayScreen]
  const B = phone ? [PhoneSessions, PhoneSession] : [SessionsScreen, SessionScreen]
  const Saved = phone ? PhonePlugins : PluginsScreen
  const cols = phone ? "grid-cols-[repeat(4,29%)]" : "grid-cols-[repeat(4,31%)]"

  return (
    <Window phone={phone}>
      <TopBar phone={phone} tab="Flows" />
      <div className="flex min-h-0 flex-1">
        {!phone && (
          <FlowsSidebar active="Connect a plugin" busy={!done} />
        )}
        <div className="bg-dots min-w-0 flex-1 overflow-hidden bg-ink-950 px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="space-y-5 sm:space-y-6">
            <section>
              <div className={`grid gap-3 sm:gap-4 ${cols}`}>
                {A.map((S, i) => (
                  <Shot key={i}><Device phone={phone}><S /></Device></Shot>
                ))}
              </div>
              <h3 className="mt-2.5 text-[14px] font-medium text-fg sm:text-[15px]">Run on a cloud machine</h3>
              <p className="text-[12px] text-fg-dim">4 screens</p>
            </section>
            <section>
              <div className={`grid gap-3 sm:gap-4 ${cols}`}>
                {B.map((S, i) => (
                  <div key={i} className={`transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${shown[i] ? "opacity-100" : "translate-y-2 scale-95 opacity-0"}`}>
                    <Shot><Device phone={phone}><S /></Device></Shot>
                  </div>
                ))}
                <div className={`transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${shown[2] ? "opacity-100" : "translate-y-2 scale-95 opacity-0"}`}>
                  <Shot ring={!done}>
                    <Device phone={phone}>{built && <Saved />}</Device>
                    {!built && (
                      <div className="absolute inset-0">
                        <PixelWaves cell={phone ? 6 : 7} />
                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#14131c]/72 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap">
                          <span className="text-shimmer">Building Plugins</span>
                        </span>
                      </div>
                    )}
                    {revealing && (
                      <div className="absolute inset-0">
                        <PixelWaves key={loop} mode="reveal" cell={phone ? 6 : 7} />
                      </div>
                    )}
                  </Shot>
                </div>
              </div>
              <h3 className="mt-2.5 text-[14px] font-medium text-fg sm:text-[15px]">Connect a plugin</h3>
              <p className="text-[12px] text-fg-dim">{done ? "3 screens" : <span className="text-shimmer">Assembling…</span>}</p>
            </section>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute top-12 right-0 bottom-0 w-12 bg-gradient-to-l from-ink-950 to-transparent sm:w-20" />
    </Window>
  )
}

/* ------------------------------------------------------------------ Flow viewer: walk, comment, draw, move, reconcile */

const VIEWER_CYCLE = 15000

const STEPS = [
  { note: "Opens the billing ledger session", action: "Clicks Event-sourced billing ledger" },
  { note: "The replay needs more than a laptop", action: "Clicks Book machine" },
  { note: "Picks a Regular Linux machine", action: "Clicks Book machine" },
  { note: "Watches the replay run on it", action: "" },
]

type Pt = [number, number]
type Geometry = {
  search: Pt
  reserve: Pt
  dragFrom: Pt
  dragTo: Pt
  pay: Pt
  moveBy: number
  /** The pen stroke around the pay button, in the screen's own coordinates. */
  stroke: string
  composer: CSSProperties
}

const DESKTOP: Geometry = {
  search: [55, 22],
  reserve: [88, 78],
  dragFrom: [61, 15],
  dragTo: [97, 66],
  pay: [16, 80],
  moveBy: 150,
  stroke: "M 14 230 C 14 214, 70 210, 120 213 C 150 215, 156 238, 140 252 C 116 268, 40 268, 22 256 C 10 247, 12 236, 20 230 M 150 244 C 190 246, 230 246, 262 244 M 250 236 L 263 244 L 250 252",
  composer: { left: "18%", top: "50%" },
}

const PHONE: Geometry = {
  search: [50, 17],
  reserve: [50, 85],
  dragFrom: [5, 9],
  dragTo: [95, 34],
  pay: [30, 93],
  moveBy: 48,
  stroke: "M 12 452 C 10 438, 60 436, 120 438 C 140 440, 142 470, 126 478 C 100 488, 30 488, 16 476 C 8 468, 10 458, 16 452 M 134 462 C 160 461, 190 461, 214 462 M 203 455 L 215 462 L 203 469",
  composer: { left: "4%", top: "36%" },
}

const NOTE = "Specs as one line, and only one accent colour."

export function FlowViewerDemo({ at }: { at?: number }) {
  const phone = usePhone()
  const t = useTimeline(VIEWER_CYCLE, 9800, at)
  const g = phone ? PHONE : DESKTOP
  const loop = Math.floor(performance.now() / VIEWER_CYCLE)

  const step = t < 2000 ? 0 : t < 4000 ? 1 : 2
  const tool = t < 4400 || t >= 11200 ? undefined : t < 7600 ? "comment" : t < 9000 ? "pen" : "select"
  const reconciled = t >= 11200
  const dragging = t >= 4800 && !reconciled
  const composer = t >= 5700 && t < 7300
  const typed = NOTE.slice(0, Math.max(0, Math.round(((t - 5800) / 1300) * NOTE.length)))
  const pinned = t >= 7300 && !reconciled
  const drawn = t >= 7800 && !reconciled
  const selected = t >= 9300 && !reconciled
  const moved = t >= 9700
  const ops = reconciled ? 0 : Number(t >= 7300) + Number(t >= 8700) + Number(t >= 9900)
  const revealing = t >= 11200 && t < 12800

  // Where the cursor is, inside the current screen; at the toolbar for Reconcile.
  let cursor: Pt | undefined
  let pressing = false
  if (t >= 400 && t < 2000) {
    cursor = g.search
    pressing = t > 1450 && t < 1750
  } else if (t >= 2300 && t < 4000) {
    cursor = g.reserve
    pressing = t > 3300 && t < 3600
  } else if (t >= 4500 && t < 4800) cursor = g.dragFrom
  else if (t >= 4800 && t < 5700) {
    cursor = g.dragTo
    pressing = true
  } else if (t >= 7600 && t < 8800) cursor = [g.pay[0] + (phone ? 8 : 12), g.pay[1] + 3]
  else if (t >= 9000 && t < 10500) {
    cursor = moved ? [g.pay[0] + (g.moveBy / (phone ? PHONE_W : SCREEN_W)) * 100, g.pay[1]] : g.pay
    pressing = t > 9300 && t < 9900
  }
  const atReconcile = t >= 10500 && t < 11400
  const pressReconcile = t >= 10950 && t < 11250

  const screen = (i: number) => {
    const checkout: BookMachineProps = {
      revised: reconciled,
      paySelected: selected,
      payStyle: moved ? { transform: `translateX(${g.moveBy}px)` } : undefined,
    }
    if (phone) return [<PhoneSessions pressed={t > 1450 && step === 0} />, <PhoneSession pressed={t > 3300 && step === 1} />, <PhoneBookMachine {...(i === 2 ? checkout : {})} />, <PhoneReplay />][i]
    return [<SessionsScreen pressed={t > 1450 && step === 0} />, <SessionScreen pressed={t > 3300 && step === 1} />, <BookMachineScreen {...(i === 2 ? checkout : {})} />, <ReplayScreen />][i]
  }

  const slotWidth = phone ? "w-[min(56cqw,43cqh)]" : "w-[min(70cqw,152cqh)]"
  const [x0, y0] = g.dragFrom
  const [x1, y1] = g.dragTo

  return (
    <Window phone={phone}>
      <TopBar phone={phone} tab="Flows" />
      <div className="flex min-h-0 flex-1">
        {!phone && <FlowsSidebar active="Run on a cloud machine" />}
        <div className="relative flex min-w-0 flex-1 flex-col bg-[#0c0c0f]">
          <div className="flex shrink-0 items-center gap-3 px-4 pt-3 pb-1 sm:px-5 sm:pt-4">
            <h3 className="truncate text-[14px] font-medium text-[#f4f4f7] sm:text-[16px]">Run on a cloud machine</h3>
            <span className="flex-1" />
            <span className="text-[12.5px] text-[#8b8b96] tabular-nums">{step + 1} / 4</span>
            <span className="flex-1 max-sm:hidden" />
            <X className="size-4 text-fg-dim" />
          </div>
          <div className="flex min-h-[44px] shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 pb-2 sm:min-h-[40px]">
            <p key={step} className="animate-rise text-center text-[12.5px] text-[#d9d9e0] sm:text-[14px]">{STEPS[step].note}</p>
            {STEPS[step].action && (
              <span key={`a${step}`} className="animate-rise inline-flex items-center gap-1.5 rounded-full bg-accent/16 px-2.5 py-1 text-[11.5px] font-medium text-lilac sm:text-[12.5px]">
                <MousePointer2 className="size-3" /> {STEPS[step].action}
              </span>
            )}
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden [container-type:size]">
            {[0, 1, 2, 3].map((i) => {
              const current = i === step
              return (
                <div
                  key={i}
                  className={`absolute top-1/2 left-1/2 ${slotWidth} overflow-hidden rounded-[12px] bg-ink-750 transition-[transform,opacity,box-shadow] duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${current ? "z-10 opacity-100 shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_30px_80px_rgb(0_0_0/0.55)]" : "opacity-40"}`}
                  style={{ transform: `translate(calc(-50% + ${(i - step) * 106}%), -50%)` }}
                >
                  <Device phone={phone}>{screen(i)}</Device>
                  {current && i === 2 && (
                    <>
                      {dragging && (
                        <span
                          className="absolute rounded-[5px] border-[1.5px] border-accent-soft bg-accent/14 transition-all duration-700 ease-out"
                          style={{ left: `${x0}%`, top: `${y0}%`, width: `${t >= 4850 ? x1 - x0 : 0}%`, height: `${t >= 4850 ? y1 - y0 : 0}%` }}
                        />
                      )}
                      {pinned && (
                        <span className="animate-rise absolute grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-[10px] font-semibold text-white shadow-lg" style={{ left: `${x0}%`, top: `${y0}%` }}>
                          1
                        </span>
                      )}
                      {drawn && (
                        <svg viewBox={phone ? `0 0 ${PHONE_W} ${PHONE_H}` : `0 0 ${SCREEN_W} ${SCREEN_H}`} className="pointer-events-none absolute inset-0 size-full" preserveAspectRatio="none">
                          <path
                            key={loop}
                            d={g.stroke}
                            fill="none"
                            stroke="#f0503c"
                            strokeWidth={phone ? 2.4 : 2.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            pathLength={1}
                            strokeDasharray={1}
                            className="animate-[draw_0.9s_ease-out_both]"
                          />
                        </svg>
                      )}
                      {revealing && (
                        <div className="absolute inset-0">
                          <PixelWaves key={loop} mode="reveal" cell={phone ? 6 : 8} />
                        </div>
                      )}
                      {cursor && <Cursor at={cursor} pressing={pressing} />}
                    </>
                  )}
                  {current && i < 2 && cursor && <Cursor at={cursor} pressing={pressing} />}
                </div>
              )
            })}
            {composer && (
              <div className="animate-rise absolute z-20 w-[230px] rounded-2xl bg-[#28282e]/97 p-3 shadow-[0_20px_60px_rgb(0_0_0/0.55),0_0_0_1px_rgb(255_255_255/0.06)] sm:w-[260px]" style={g.composer}>
                <div className="flex gap-1.5 text-[10.5px] text-[#b4b4be]">
                  <span className="rounded-md bg-white/7 px-1.5 py-0.5">Book machine</span>
                  <span className="rounded-md bg-white/7 px-1.5 py-0.5 font-mono">MachineSummary</span>
                </div>
                <p className="mt-2 min-h-[2.6em] text-[12.5px] leading-snug text-[#f2f2f5]">
                  {typed}
                  {typed.length < NOTE.length && <span className="animate-blink ml-px inline-block h-3.5 w-px translate-y-0.5 bg-fg" />}
                </p>
                <div className="mt-2 flex items-center">
                  <AgentStack size="sm" />
                  <span className="ml-auto grid size-6 place-items-center rounded-full bg-[#ebebf0] text-[#16161b]"><ArrowUp className="size-3.5" /></span>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-center px-3 pt-2 pb-3 sm:pb-4">
            <div className="relative flex items-center gap-0.5 rounded-full bg-[#28282e] p-1 shadow-[0_12px_40px_rgb(0_0_0/0.5),0_0_0_1px_rgb(255_255_255/0.06)]">
              {(
                [
                  ["comment", MessageSquarePlus],
                  ["select", MousePointer2],
                  ["pen", Pen],
                  ["block", Square],
                  ["component", Component],
                ] as const
              ).map(([name, Icon]) => (
                <span
                  key={name}
                  className={`grid size-8 place-items-center rounded-full transition-colors ${tool === name ? "bg-[#ebebf0] text-[#16161b]" : "text-[#b4b4be]"} ${phone && (name === "block" || name === "component") ? "hidden" : ""}`}
                >
                  <Icon className="size-[15px]" />
                </span>
              ))}
              <span className="mx-1 h-5 w-px bg-white/10 max-sm:hidden" />
              <span className="grid size-8 place-items-center rounded-full text-[#b4b4be] max-sm:hidden"><Undo2 className="size-[15px]" /></span>
              <span className="mx-1 h-5 w-px bg-white/10" />
              <span
                className={`inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-medium transition-[background-color,color,transform] duration-150 ${ops ? "bg-[#ebebf0] text-[#16161b]" : "bg-white/8 text-[#ececf1]/40"} ${pressReconcile ? "scale-95" : ""}`}
              >
                Reconcile
                {ops > 0 && <span key={ops} className="animate-rise grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1 text-[10.5px] text-white">{ops}</span>}
              </span>
              {atReconcile && <Cursor at={[phone ? 82 : 86, 62]} pressing={pressReconcile} />}
            </div>
          </div>
        </div>
      </div>
    </Window>
  )
}

function Cursor({ at, pressing }: { at: Pt; pressing?: boolean }) {
  return (
    <span
      className="pointer-events-none absolute z-30 transition-[left,top] duration-700 ease-[cubic-bezier(.32,.72,0,1)]"
      style={{ left: `${at[0]}%`, top: `${at[1]}%` }}
    >
      <svg viewBox="0 0 24 24" className={`size-5 -translate-x-[3px] -translate-y-[2px] drop-shadow-[0_2px_4px_rgb(0_0_0/0.4)] transition-transform duration-150 ${pressing ? "scale-85" : ""}`}>
        <path d="M4 3l16 7.5-7 1.6-3.2 6.9L4 3z" fill="#16161b" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
