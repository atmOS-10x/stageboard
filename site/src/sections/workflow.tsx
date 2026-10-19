import { useEffect, useState, type ReactNode } from "react"
import { variant } from "@atmos.build/stageboard/react"
import { FlowViewerDemo } from "../components/demos"
import { Cpu, MemoryStick } from "lucide-react"

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
  ["$", "npm i -D @atmos.build/stageboard", ""],
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
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
          {[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-white/10" />)}
          <span className="ml-3 text-[11.5px] text-fg-faint">billing-api</span>
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

const VARIANTS = ["Original", "Size cards", "Radio list"] as const

const MACHINES = [
  ["Dani's MacBook", "dani@atmos.build", "M3 Max, 64 GB", true],
  ["sap-gateway", "Platform", "Regular, desktop", false],
  ["staging-db", "Platform", "Large, headless", true],
] as const

const SIZES = [
  ["Small", "2 vCPU", "4 GB"],
  ["Regular", "4 vCPU", "8 GB"],
  ["Large", "8 vCPU", "16 GB"],
] as const

function BookButton({ wide }: { wide?: boolean }) {
  return <span className={`inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-zinc-950 px-3.5 text-[12px] font-medium text-white ${wide ? "w-full" : ""}`}>Book machine</span>
}

// The three takes on "Book a cloud machine" the agent wrote. Each fills the same fixed-height slot, so switching
// between them never moves the page.
function BookPanel({ kind }: { kind: (typeof VARIANTS)[number] }) {
  if (kind === "Size cards")
    return (
      <div className="flex h-full flex-col gap-2.5">
        <div className="grid flex-1 grid-cols-3 gap-2">
          {SIZES.map(([name, cpu, ram], i) => (
            <div key={name} className={`min-w-0 rounded-md border px-2 py-2 sm:px-2.5 ${i === 1 ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200"}`}>
              <span className="text-[12px] font-medium text-zinc-900">{name}</span>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] whitespace-nowrap text-zinc-600"><Cpu className="size-3 text-zinc-400" strokeWidth={1.6} /> {cpu}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] whitespace-nowrap text-zinc-600"><MemoryStick className="size-3 text-zinc-400" strokeWidth={1.6} /> {ram}</div>
            </div>
          ))}
        </div>
        <BookButton wide />
      </div>
    )
  if (kind === "Radio list")
    return (
      <div className="flex h-full flex-col gap-2.5">
        <div className="flex flex-1 flex-col gap-0.5">
          {SIZES.map(([name, cpu, ram], i) => (
            <div key={name} className={`flex flex-1 items-center gap-2.5 rounded-md px-3 text-[11.5px] ${i === 1 ? "bg-zinc-100" : ""}`}>
              <span className={`grid size-3.5 place-items-center rounded-full border ${i === 1 ? "border-zinc-900" : "border-zinc-300"}`}>{i === 1 && <span className="size-1.5 rounded-full bg-zinc-900" />}</span>
              <span className="font-medium text-zinc-900">{name}</span>
              <span className="ml-auto text-zinc-500">{cpu}, {ram}</span>
            </div>
          ))}
        </div>
        <BookButton wide />
      </div>
    )
  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="text-[13px] font-medium text-zinc-900">Book a cloud machine</div>
        <div className="mt-0.5 text-[11px] text-zinc-500">Linux, up to 16 vCPU and 32 GB. It stays on between sessions.</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 rounded-md bg-zinc-100 p-0.5 text-[11px]">
          {SIZES.map(([name], i) => (
            <span key={name} className={`flex-1 rounded-[5px] py-1 text-center ${i === 1 ? "bg-white font-medium text-zinc-900 shadow-sm" : "text-zinc-500"}`}>{name}</span>
          ))}
        </div>
        <BookButton />
      </div>
    </div>
  )
}

/** `at` shows one variant and stops the cycling, for stories and screenshots. */
export function VariantVisual({ at }: { at?: number }) {
  const [i, setI] = useState(at ?? 0)
  const [paused, setPaused] = useState(at !== undefined)
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setI((n) => (n + 1) % VARIANTS.length), 2600)
    return () => clearInterval(id)
  }, [paused])
  return (
    <Panel>
      <div className="overflow-hidden rounded-[10px] bg-white text-zinc-900 shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_20px_50px_rgb(0_0_0/0.45)]">
        <div className="px-5 pt-4">
          <div className="text-[15px] font-semibold tracking-tight">Machines</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">Where your team's sessions run.</div>
        </div>
        <div className="mt-3 px-5">
          {MACHINES.map(([name, owner, size, ready]) => (
            <div key={name} className="grid grid-cols-[1fr_auto] items-center py-1.5 text-[12px] sm:grid-cols-[1.3fr_1fr_auto]">
              <div className="min-w-0 leading-tight">
                <div className="truncate font-medium">{name}</div>
                <div className="truncate text-[10.5px] text-zinc-500">{owner}</div>
              </div>
              <span className="text-[11.5px] text-zinc-600 max-sm:hidden">{size}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                <span className={`size-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-zinc-300"}`} />
                {ready ? "Ready" : "Paused"}
              </span>
            </div>
          ))}
        </div>
        <div className="px-5 pt-10 pb-6">
          <div className="relative">
            <span className="pointer-events-none absolute -inset-3 rounded-[6px] border-2 border-variant" />
            <span className="absolute -top-3 -left-3 -translate-y-full rounded-t-[6px] rounded-br-[6px] bg-variant px-2 py-0.5 text-[10.5px] leading-4 font-semibold text-[#1e1a0c]">machines.book</span>
            <div key={VARIANTS[i]} className="h-[128px] animate-[appear_.35s_ease-out] sm:h-[118px]">
              <BookPanel kind={VARIANTS[i]} />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <div className="flex rounded-full bg-white/6 p-0.5 text-[12.5px]" role="radiogroup" aria-label="Variants of machines.book">
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
              className={`rounded-full px-3.5 py-1.5 font-medium whitespace-nowrap transition-colors ${i === n ? "bg-[#ebebf0] text-[#16161b]" : "text-fg-dim hover:text-fg"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <span className="inline-flex h-8 w-[136px] items-center justify-center rounded-full bg-white/8 text-[12.5px] font-medium text-fg">Keep this one</span>
      </div>
    </Panel>
  )
}
