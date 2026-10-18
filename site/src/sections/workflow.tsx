import { useEffect, useState, type ReactNode } from "react"
import { variant } from "stageboard/react"
import { FlowViewerDemo } from "../components/demos"
import { Photo } from "../components/mini-screens"

function StepHead({ n, title, body, detail }: { n: string; title: string; body: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <span className="inline-flex h-7 items-center rounded-full bg-white/7 px-3 font-mono text-[12px] text-fg-soft">{n}</span>
      <h3 className="mt-4 text-[26px] leading-tight font-semibold tracking-[-0.025em] text-balance text-white sm:text-[30px]">{title}</h3>
      <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-pretty text-fg-dim">{body}</p>
      {detail && (
        <p className="mt-5 flex items-start gap-2 text-[13.5px] text-fg-soft">
          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent-soft" />
          {detail}
        </p>
      )}
    </div>
  )
}

function WorkflowImpl() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:py-32">
      <div className="max-w-2xl">
        <p className="text-[13px] font-medium text-lilac">How it works</p>
        <h2 className="mt-3 text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] text-balance text-white sm:text-[46px]">
          The design loop, without leaving your repo.
        </h2>
      </div>

      <div className="mt-16 grid items-center gap-10 sm:mt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <StepHead
          n="01"
          title="Paste one prompt"
          body="Your agent installs stageboard, writes stories with mock data and puts every page and flow on the board. No backend, no login."
          detail="It screenshots each screen to check its own work"
        />
        <div className="min-w-0">
          <SetupVisual />
        </div>
      </div>

      <div className="mt-24 sm:mt-32">
        <StepHead
          n="02"
          title="Walk a flow, mark it up, reconcile"
          body="Step through a journey screen by screen. Comment on a region, draw on it, move things around. Reconcile sends all of it to your agent, which changes the real components."
        />
        <div className="mt-10">
          <FlowViewerDemo />
        </div>
      </div>

      <div className="mt-24 grid items-center gap-10 sm:mt-32 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div className="min-w-0 lg:order-2">
          <StepHead
            n="03"
            title="Pick from live variants"
            body="Variants appear on the live screen while the agent writes them, outlined in yellow. Keep the one that works, or the original. Production always renders the original."
            detail="Each variant is a .variant.tsx file you can review"
          />
        </div>
        <div className="min-w-0 lg:order-1">
          <VariantVisual />
        </div>
      </div>
    </section>
  )
}

export const Workflow = variant("landing.workflow", WorkflowImpl)

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-dots relative overflow-hidden rounded-2xl border border-white/8 bg-ink-950 p-5 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)] sm:p-7 ${className ?? ""}`}>
      {children}
    </div>
  )
}

const SETUP_LINES = [
  ["$", "npm i -D stageboard", ""],
  ["✓", "wrote stageboard.config.ts and a preview", ""],
  ["✓", "14 component stories", ""],
  ["✓", "6 screens with mock data", ""],
  ["✓", "2 flows: booking, saving stays", ""],
  ["✓", "stageboard shot on every screen", ""],
  ["→", "Looks weak: Search with no results", ""],
]

export function SetupVisual() {
  const [shown, setShown] = useState(1)
  useEffect(() => {
    const id = setInterval(() => setShown((n) => (n >= SETUP_LINES.length + 3 ? 1 : n + 1)), 700)
    return () => clearInterval(id)
  }, [])
  return (
    <Panel>
      <div className="rounded-xl border border-white/8 bg-ink-800 font-mono text-[12px] shadow-[0_20px_50px_rgb(0_0_0/0.45)] sm:text-[12.5px]">
        <div className="flex items-center gap-1.5 border-b border-white/6 px-4 py-3">
          {[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-white/10" />)}
          <span className="ml-3 text-[11.5px] text-fg-faint">fernway</span>
        </div>
        {/* A fixed height, so the panel doesn't grow as lines arrive. */}
        <div className="h-[318px] space-y-2 overflow-hidden p-4 leading-relaxed">
          <p className="rounded-lg bg-white/5 px-3 py-2 font-sans text-[13px] text-fg-soft">Set up stageboard in this repo…</p>
          {SETUP_LINES.slice(0, shown).map(([mark, text]) => (
            <p key={text} className="animate-rise flex gap-3 whitespace-nowrap">
              <span className={mark === "✓" ? "text-emerald-400" : mark === "→" ? "text-variant" : "text-fg-faint"}>{mark}</span>
              <span className="truncate text-fg-soft">{text}</span>
            </p>
          ))}
          <span className={`animate-blink inline-block h-4 w-2 translate-y-0.5 bg-fg-dim ${shown > SETUP_LINES.length ? "invisible" : ""}`} />
        </div>
      </div>
    </Panel>
  )
}

const VARIANTS = ["Original", "Calm", "Split"] as const

function ReserveCard({ kind }: { kind: (typeof VARIANTS)[number] }) {
  if (kind === "Calm")
    return (
      <div className="rounded-2xl bg-zinc-50 p-4 text-zinc-900">
        <div className="text-[10px] tracking-wide text-zinc-500 uppercase">3 nights</div>
        <div className="mt-1 text-[22px] font-semibold tracking-tight">€462</div>
        <div className="mt-3 rounded-full bg-zinc-900 py-2 text-center text-[11px] font-medium text-white">Reserve</div>
      </div>
    )
  if (kind === "Split")
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-3 text-zinc-900">
        <div className="flex-1">
          <div className="text-[18px] font-semibold">€140</div>
          <div className="text-[9.5px] text-zinc-500">per night</div>
        </div>
        <div className="rounded-xl bg-emerald-700 px-4 py-2.5 text-[11px] font-medium text-white">Reserve</div>
      </div>
    )
  return (
    <div className="rounded-xl border border-zinc-200 p-3 text-zinc-900 shadow-sm">
      <div className="text-[14px] font-semibold">€140 <span className="text-[10px] font-normal text-zinc-500">night</span></div>
      <div className="mt-2 rounded-md border border-zinc-200 px-2 py-1.5 text-[10px] text-zinc-500">Jun 12 – 15, 2 guests</div>
      <div className="mt-2 rounded-full bg-emerald-700 py-1.5 text-center text-[11px] font-medium text-white">Reserve</div>
    </div>
  )
}

export function VariantVisual() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setI((n) => (n + 1) % VARIANTS.length), 2400)
    return () => clearInterval(id)
  }, [paused])
  return (
    <Panel>
      <div className="overflow-hidden rounded-[10px] bg-white shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_20px_50px_rgb(0_0_0/0.45)]">
        <div className="flex h-9 items-center gap-4 border-b border-zinc-100 px-5 text-[10.5px] text-zinc-500">
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-900"><span className="size-3 rounded-full bg-emerald-600" /> Fernway</span>
          <span className="font-medium text-zinc-900">Stays</span>
          <span>Trips</span>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_190px]">
          <div>
            <Photo name="bled-cabin" className="h-[130px] w-full rounded-xl" />
            <div className="mt-3 text-[17px] font-semibold tracking-tight text-zinc-900">Cabin on Lake Bled</div>
            <div className="mt-1 text-[11px] leading-snug text-zinc-500">A timber cabin on the north shore, with a wood stove and a private jetty.</div>
          </div>
          <div className="relative mt-3 self-start sm:mt-0">
            <span className="pointer-events-none absolute -inset-2 rounded-[14px] border-[1.5px] border-variant bg-variant/7" />
            <span className="absolute -top-6 -left-2 rounded-md bg-variant px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-[#2a2205]">listing.reserve</span>
            <div key={VARIANTS[i]} className="animate-rise relative">
              <ReserveCard kind={VARIANTS[i]} />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <div className="flex rounded-full bg-white/6 p-0.5 text-[12.5px]" role="radiogroup" aria-label="Variants of listing.reserve">
          {VARIANTS.map((v, n) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={i === n}
              onClick={() => {
                setPaused(true)
                setI(n)
              }}
              className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${i === n ? "bg-[#ebebf0] text-[#16161b]" : "text-fg-dim hover:text-fg"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <span className="inline-flex h-8 items-center rounded-full bg-white/8 px-3.5 text-[12.5px] font-medium text-fg">Keep {VARIANTS[i]}</span>
      </div>
    </Panel>
  )
}
