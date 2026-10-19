import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, ChevronRight, Cpu, Folder, HardDrive, Laptop, MemoryStick, MessagesSquare, Mic, MoreHorizontal, PanelLeft, Plus, Search, SquarePen, Users, Settings2, Plug, MessageSquare } from "lucide-react"
import { AtmosLogo, ClaudeLogo, OpenAILogo } from "./agent-logos"

// Screens of atmOS (atmos.build), the app the demos annotate. Copied from the atmos.build home page: the team
// session window, the machine booking card and the GitHub plugin page, at atmOS's own type sizes (desktop is drawn
// at 960 × 600, phone at 360 × 750) and scaled down the way the board shows thumbnails.

export const SCREEN_W = 960
export const SCREEN_H = 600
export const PHONE_W = 360
export const PHONE_H = 750

export function Scaled({ children, width = SCREEN_W, height = SCREEN_H, className }: { children: ReactNode; width?: number; height?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setK(el.clientWidth / width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])
  return (
    <div ref={ref} className={`relative w-full overflow-hidden ${className ?? ""}`} style={{ aspectRatio: `${width} / ${height}` }}>
      <div className="absolute top-0 left-0 origin-top-left" style={{ width, height, transform: `scale(${k})`, visibility: k ? undefined : "hidden" }}>
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ atmOS bits */

type Person = "dani" | "philipp" | "mara"

function Face({ who, className = "size-6" }: { who: Person; className?: string }) {
  return <img src={`/people/${who}.webp`} alt="" draggable={false} className={`shrink-0 rounded-full bg-zinc-200 object-cover ${className}`} />
}

/** Thomas is a Naut: an orange tile with a face. */
function Thomas({ className = "size-6" }: { className?: string }) {
  return (
    <span className={`relative grid shrink-0 place-items-center rounded-[6px] bg-[#f26b4a] ${className}`}>
      <span className="flex gap-[18%]">
        <span className="h-[3px] w-[3px] rounded-full bg-white" />
        <span className="h-[3px] w-[3px] rounded-full bg-white" />
      </span>
    </span>
  )
}

function Harness({ kind, className = "size-6" }: { kind: "claude" | "codex"; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full ${kind === "claude" ? "bg-zinc-100" : "bg-zinc-900"} ${className}`}>
      {kind === "claude" ? <ClaudeLogo className="size-[58%] text-[#d97757]" /> : <OpenAILogo className="size-[58%] text-white" />}
    </span>
  )
}

function Lights() {
  return (
    <span className="flex gap-[7px]">
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <span key={c} className="size-3 rounded-full" style={{ background: c }} />
      ))}
    </span>
  )
}

function TeamShape({ team }: { team: "Platform" | "Design" | "Growth" }) {
  if (team === "Platform")
    return (
      <svg viewBox="0 0 16 16" className="size-4"><path d="M8 1.2l5.9 3.4v6.8L8 14.8l-5.9-3.4V4.6z" fill="#3b82f6" /></svg>
    )
  if (team === "Design") return <svg viewBox="0 0 16 16" className="size-4"><path d="M8 1.5l6.5 6.5L8 14.5 1.5 8z" fill="#8b5cf6" /></svg>
  return <svg viewBox="0 0 16 16" className="size-4"><path d="M8 2l6.5 11.5h-13z" fill="#22a06b" /></svg>
}

const SIDEBAR_SESSIONS = [
  { project: "billing-api", title: "Event-sourced billing ledger", harness: "claude", people: ["philipp", "dani"], running: "" },
  { project: "billing-api", title: "Move invoice jobs to Temporal", harness: "codex", people: ["mara"], running: "" },
  { project: "web", title: "Fix the flaky checkout e2e test", harness: "claude", people: [], running: "4m" },
] as const

/** The atmOS sidebar from the atmos.build hero: window controls, search, Thomas, Teams, Sessions. */
function Sidebar({ selected, pressed }: { selected: number; pressed?: boolean }) {
  return (
    <div className="flex w-[240px] shrink-0 flex-col border-r border-zinc-200 bg-white text-[13px] text-zinc-900">
      <div className="flex h-10 items-center gap-3 px-3.5 text-zinc-400">
        <Lights />
        <PanelLeft className="ml-1 size-4" strokeWidth={1.6} />
        <ArrowLeft className="size-4" strokeWidth={1.6} />
        <ArrowRight className="size-4 opacity-50" strokeWidth={1.6} />
        <span className="flex-1" />
        <AtmosLogo className="size-4 text-zinc-900" />
      </div>
      <div className="flex h-9 items-center gap-2 px-3.5 text-zinc-400">
        <Search className="size-4" strokeWidth={1.6} /> Search…
        <span className="flex-1" />
        <SquarePen className="size-4" strokeWidth={1.6} />
      </div>
      <div className="mt-2 flex h-8 items-center gap-2.5 px-3.5">
        <Thomas className="size-4" /> Thomas
      </div>
      <div className="mt-3 px-3.5 text-[12px] text-zinc-500">Teams</div>
      {(["Platform", "Design", "Growth"] as const).map((t) => (
        <div key={t} className="flex h-8 items-center gap-2.5 px-3.5">
          <TeamShape team={t} /> {t}
        </div>
      ))}
      <div className="mt-3 px-3.5 text-[12px] text-zinc-500">Sessions</div>
      <div className="mt-1 space-y-0.5 px-1.5">
        {SIDEBAR_SESSIONS.map((s, i) => (
          <div key={s.title} className={`flex h-[46px] items-center gap-2.5 rounded-lg px-2 transition-colors ${i === selected ? "bg-zinc-100" : pressed && i === 0 ? "bg-zinc-100 ring-1 ring-zinc-300" : ""}`}>
            <Harness kind={s.harness} className="size-[22px]" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[11.5px] text-zinc-500">{s.project}</div>
              <div className="truncate">{s.title}</div>
            </div>
            {s.running && <span className="text-[11.5px] text-zinc-500">{s.running}</span>}
            <span className="flex -space-x-1.5">
              {s.people.map((p) => (
                <Face key={p} who={p} className="size-5 ring-2 ring-white" />
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PaneHeader({ project, title }: { project: string; title: string }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 px-5 text-[13px] text-zinc-500">
      <Folder className="size-4" strokeWidth={1.6} /> {project} <span className="text-zinc-300">/</span> <span className="text-zinc-900">{title}</span>
      <span className="flex-1" />
      <MessagesSquare className="size-4" strokeWidth={1.6} />
      <MoreHorizontal className="size-4" strokeWidth={1.6} />
    </div>
  )
}

function Msg({ avatar, name, time, children }: { avatar: ReactNode; name: string; time: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5">{avatar}</span>
      <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-zinc-900">
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{name}</span>
          <span className="text-[12px] text-zinc-500">{time}</span>
        </div>
        <div className="mt-1 space-y-2">{children}</div>
      </div>
    </div>
  )
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-zinc-100 px-1 py-px font-mono text-[12.5px]">{children}</code>
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-px font-medium">{children}</span>
}

function Step({ verb, file, plus, minus }: { verb: string; file: string; plus?: number; minus?: number }) {
  return (
    <div className="flex items-center gap-2 text-zinc-500">
      {verb === "Read" ? <span className="text-zinc-900">✳</span> : <ChevronRight className="size-3.5" />}
      {verb} <span className="underline decoration-zinc-300 underline-offset-2">{file}</span>
      {plus !== undefined && <span className="font-mono text-[11.5px] text-emerald-600">+{plus}</span>}
      {minus !== undefined && <span className="font-mono text-[11.5px] text-rose-500">-{minus}</span>}
    </div>
  )
}

function Composer({ machine = "Dani's MacBook", phone }: { machine?: string; phone?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-300 bg-white px-4 pt-3 pb-2.5 text-[13px] shadow-sm">
      <div className="truncate text-zinc-400">Mention skills with $ or browse commands with /</div>
      <div className="mt-3 flex items-center gap-3 text-[12.5px] text-zinc-500">
        <Plus className="size-4" strokeWidth={1.6} />
        <span className="flex items-center gap-1.5"><Laptop className="size-3.5" strokeWidth={1.6} /> {machine}</span>
        <span className="flex-1" />
        {!phone && <span className="flex items-center gap-1"><ClaudeLogo className="size-3.5 text-[#d97757]" /> Claude Opus 5.5 High <ChevronDown className="size-3" /></span>}
        <Mic className="size-4" strokeWidth={1.6} />
        <span className="grid size-6 place-items-center rounded-full bg-zinc-900 text-white"><ArrowUp className="size-3.5" /></span>
      </div>
    </div>
  )
}

function ClaudeWork() {
  return (
    <>
      <div className="text-zinc-500">Worked for 2m 41s</div>
      <Step verb="Read" file="CLAUDE.md" />
      <Step verb="Edited" file="internal/billing/ledger/writer.go" plus={64} minus={0} />
      <Step verb="Edited" file="internal/billing/payments.go" plus={1} minus={5} />
      <p>
        Following <Chip>✳ CLAUDE.md</Chip>, balances now have one writer and <Chip>∞ payments.go</Chip> only appends a credit. Replaying Tuesday's snapshot needs more than a laptop.
      </p>
    </>
  )
}

function Bars() {
  const rows = [
    ["Invoice run", 92, 31],
    ["POST /payments", 41, 16],
    ["POST /refunds", 30, 12],
  ] as const
  return (
    <div className="pt-1">
      <div className="flex gap-1.5 text-[12px]">
        <span className="rounded-md border border-zinc-200 px-2 py-0.5">Today</span>
        <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-white">With the ledger</span>
      </div>
      <div className="mt-2.5 space-y-2 text-[12.5px]">
        {rows.map(([label, , after]) => (
          <div key={label} className="flex items-center gap-3">
            <span className="w-[112px] shrink-0">{label}</span>
            <span className="h-2 rounded-full bg-zinc-900" style={{ width: `${after * 3}px` }} />
            <span className="text-zinc-500">{Math.round(after * 20)} ms</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ desktop */

export function SessionsScreen({ pressed }: { pressed?: boolean }) {
  return (
    <div className="flex h-full w-full bg-white">
      <Sidebar selected={2} pressed={pressed} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <PaneHeader project="web" title="Fix the flaky checkout e2e test" />
        <div className="space-y-5 px-5 pt-3">
          <Msg avatar={<Face who="mara" />} name="Mara" time="9:41 AM">
            <p>The checkout e2e test fails one run in five. Can you find out why?</p>
          </Msg>
          <Msg avatar={<Harness kind="claude" />} name="Claude Code" time="9:43 AM">
            <div className="text-zinc-500">Worked for 4m 12s</div>
            <Step verb="Read" file="e2e/checkout.spec.ts" />
            <Step verb="Edited" file="e2e/checkout.spec.ts" plus={6} minus={2} />
            <p>The test clicked Pay before the Stripe iframe was ready. It now waits for it. 50 runs in a row pass.</p>
          </Msg>
        </div>
        <div className="absolute inset-x-5 bottom-4">
          <Composer />
        </div>
      </div>
    </div>
  )
}

export function SessionScreen({ pressed }: { pressed?: boolean }) {
  return (
    <div className="flex h-full w-full bg-white">
      <Sidebar selected={0} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <PaneHeader project="billing-api" title="Event-sourced billing ledger" />
        <div className="space-y-5 px-5 pt-3">
          <Msg avatar={<Thomas />} name="Thomas" time="10:02 AM">
            <p>
              Pulled 30 days of billing incidents. 4 of 6 trace back to the read-modify-write in <Code>ApplyPayment</Code>. Claude, move balances behind one writer.
            </p>
          </Msg>
          <Msg avatar={<Harness kind="claude" />} name="Claude Code" time="10:04 AM">
            <ClaudeWork />
          </Msg>
        </div>
        <div className="absolute inset-x-5 bottom-[116px] flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 pr-1.5 pl-3.5 text-[13px] text-zinc-600">
          <Laptop className="size-4 text-zinc-400" strokeWidth={1.6} /> The replay needs more than Dani's MacBook.
          <span className="flex-1" />
          <span className={`flex h-7 w-[110px] items-center justify-center rounded-lg text-[12.5px] font-medium text-white transition-colors ${pressed ? "bg-zinc-600" : "bg-zinc-900"}`}>Book machine</span>
        </div>
        <div className="absolute inset-x-5 bottom-4">
          <Composer />
        </div>
      </div>
    </div>
  )
}

function OsMark({ os }: { os: "linux" | "windows" }) {
  if (os === "windows")
    return (
      <svg viewBox="0 0 16 16" className="size-5"><path d="M1 2.5l6-.9V7.5H1zM8 1.4L15 .5v7H8zM1 8.5h6v5.9l-6-.9zM8 8.5h7v7l-7-1z" fill="#18181b" /></svg>
    )
  return (
    <svg viewBox="0 0 16 16" className="size-5" fill="none" stroke="#18181b" strokeWidth="1.2">
      <ellipse cx="8" cy="5" rx="2.6" ry="3.2" />
      <path d="M5.4 6.5C3.6 9 3 12 4.5 14h7c1.5-2 .9-5-.9-7.5" />
      <circle cx="7" cy="4.4" r=".4" fill="#18181b" />
      <circle cx="9" cy="4.4" r=".4" fill="#18181b" />
    </svg>
  )
}

function Tile({ on, children }: { on?: boolean; children: ReactNode }) {
  return (
    <div className={`relative flex-1 rounded-xl border px-3 py-2.5 text-[13px] ${on ? "border-zinc-400 bg-zinc-100" : "border-zinc-200 bg-white"}`}>
      {on && <Check className="absolute top-2.5 right-2.5 size-3.5 text-zinc-700" />}
      {children}
    </div>
  )
}

const MACHINES = [
  ["Dani's MacBook", "Your laptop", true],
  ["sap-gateway", "Regular, desktop", false],
  ["staging-db", "Large, headless", true],
] as const

export type BookMachineProps = {
  /** The design after the agent reconciled the sketch: stats side by side and a full-width button, as atmOS ships it. */
  revised?: boolean
  payStyle?: CSSProperties
  paySelected?: boolean
}

function Stats({ revised }: { revised?: boolean }) {
  const stats = [
    [Cpu, "8", "vCPU"],
    [MemoryStick, "16", "GB RAM"],
    [HardDrive, "320", "GB disk"],
  ] as const
  if (revised)
    return (
      <div className="grid grid-cols-3 divide-x divide-zinc-200 text-center">
        {stats.map(([Icon, n, unit]) => (
          <div key={unit} className="py-1">
            <Icon className="mx-auto size-4 text-zinc-400" strokeWidth={1.6} />
            <div className="mt-1 text-[17px] text-zinc-900">{n}</div>
            <div className="text-[11.5px] text-zinc-500">{unit}</div>
          </div>
        ))}
      </div>
    )
  return (
    <div className="space-y-1 rounded-xl bg-zinc-50 px-3 py-2 text-[13px]">
      {stats.map(([Icon, n, unit]) => (
        <div key={unit} className="flex items-center gap-2 text-zinc-500">
          <Icon className="size-3.5" strokeWidth={1.6} /> {unit.replace("GB ", "")}
          <span className="ml-auto font-medium text-violet-700">
            {n} {unit.startsWith("GB") ? "GB" : "vCPU"}
          </span>
        </div>
      ))}
    </div>
  )
}

function SizeSlider() {
  return (
    <div>
      <div className="relative mt-3 h-1 rounded-full bg-zinc-200">
        <div className="absolute inset-y-0 left-0 w-[75%] rounded-full bg-zinc-900" />
        <span className="absolute top-1/2 left-[75%] size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-900 bg-white" />
      </div>
      <div className="mt-2.5 flex justify-between text-[11.5px] text-zinc-500">
        {["Tiny", "Small", "Regular", "Large", "Extra large"].map((s) => (
          <span key={s} className={s === "Large" ? "font-medium text-zinc-900" : ""}>{s}</span>
        ))}
      </div>
    </div>
  )
}

export function BookMachineScreen({ revised, payStyle, paySelected }: BookMachineProps) {
  return (
    <div className="flex h-full w-full bg-white text-zinc-900">
      <div className="relative w-[520px] shrink-0 border-r border-zinc-200 px-7 pt-6">
        <div className="text-[15px] font-medium">Book a cloud machine</div>
        <div className="mt-4 text-[12.5px] text-zinc-500">Operating system</div>
        <div className="mt-2 flex gap-2.5">
          <Tile on><OsMark os="linux" /><div className="mt-2">Linux</div></Tile>
          <Tile><OsMark os="windows" /><div className="mt-2">Windows</div></Tile>
        </div>
        <div className="mt-4 text-[12.5px] text-zinc-500">Type</div>
        <div className="mt-2 flex gap-2.5">
          <Tile>Headless<div className="text-[11.5px] text-zinc-500">No desktop</div></Tile>
          <Tile on>Desktop<div className="text-[11.5px] text-zinc-500">A screen you can watch</div></Tile>
        </div>
        <div className="mt-4 text-[12.5px] text-zinc-500">Size</div>
        <SizeSlider />
        <div className="absolute inset-x-7 top-[342px]">
          <Stats revised={revised} />
        </div>
        {revised ? (
          <div className="absolute inset-x-7 top-[440px] flex h-9 items-center justify-center rounded-lg bg-zinc-950 text-[13px] font-medium text-white">Book machine</div>
        ) : (
          <div className="absolute top-[440px] left-7 w-40 transition-[width] duration-700 ease-[cubic-bezier(.32,.72,0,1)]" style={payStyle}>
            <div className="flex h-9 items-center justify-center rounded-lg bg-zinc-950 text-[13px] font-medium text-white">Book machine</div>
            {paySelected && <SelectionHandles />}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 px-5 pt-6 text-[13px]">
        <div className="text-[12.5px] text-zinc-500">Machines</div>
        <div className="mt-3 space-y-4">
          {MACHINES.map(([name, spec, ready]) => (
            <div key={name} className="flex items-center gap-3">
              <Laptop className="size-4 text-zinc-700" strokeWidth={1.6} />
              <div className="min-w-0 flex-1 leading-tight">
                <div>{name}</div>
                <div className="text-[11.5px] text-zinc-500">{spec}</div>
              </div>
              <span className="flex items-center gap-1.5 text-[12px] text-zinc-600">
                <span className={`size-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-zinc-300"}`} /> {ready ? "Ready" : "Paused"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ReplayScreen() {
  return (
    <div className="flex h-full w-full bg-white">
      <Sidebar selected={0} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <PaneHeader project="billing-api" title="Event-sourced billing ledger" />
        <div className="space-y-5 px-5 pt-3">
          <Msg avatar={<Harness kind="claude" />} name="Claude Code" time="10:09 AM">
            <p>
              Booted <Code>staging-ledger</Code>, a Large Linux desktop. Replaying Tuesday's snapshot:
            </p>
            <Bars />
          </Msg>
          <Msg avatar={<Face who="dani" />} name="Dani" time="10:12 AM">
            <p>Ship the writer behind a flag. Philipp checks the projector against prod first.</p>
          </Msg>
        </div>
        <div className="absolute inset-x-5 bottom-4">
          <Composer machine="staging-ledger" />
        </div>
      </div>
    </div>
  )
}

export function PluginsScreen() {
  return (
    <div className="flex h-full w-full bg-white text-[13px] text-zinc-900">
      <div className="w-[208px] shrink-0 border-r border-zinc-200 bg-zinc-50/60 px-2 pt-4">
        <div className="flex items-center gap-1.5 px-2 text-zinc-500"><ArrowLeft className="size-3.5" /> Back</div>
        <div className="mt-3 flex items-center gap-2.5 px-2">
          <TeamShape team="Platform" />
          <div className="leading-tight">
            <div>Platform</div>
            <div className="text-[11.5px] text-zinc-500">4 members</div>
          </div>
        </div>
        <div className="mt-3 space-y-0.5">
          {[
            [Settings2, "General"],
            [Users, "Members"],
            [Laptop, "Machines"],
            [Plug, "Plugins"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Users
            return (
              <div key={label as string} className={`flex h-8 items-center gap-2.5 rounded-md px-2 ${label === "Plugins" ? "bg-zinc-200/70" : ""}`}>
                <I className="size-3.5 text-zinc-500" strokeWidth={1.6} /> {label as string}
              </div>
            )
          })}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex h-10 items-center gap-2 border-b border-zinc-200 px-5 text-zinc-500">
          Platform <span className="text-zinc-300">/</span> Plugins <span className="text-zinc-300">/</span>
          <img src="/integrations/github.svg" alt="" className="size-3.5" /> <span className="text-zinc-900">GitHub</span>
        </div>
        <div className="px-7 pt-5">
          <div className="flex items-center gap-1.5 text-zinc-500"><ArrowLeft className="size-3.5" /> Plugins</div>
          <img src="/integrations/github.svg" alt="" className="mt-3 size-9" />
          <div className="mt-2 flex items-center">
            <div className="text-[21px] font-semibold tracking-tight">GitHub</div>
            <span className="flex-1" />
            <span className="flex items-center gap-1.5 rounded-lg bg-zinc-950 px-3 py-1.5 text-[12.5px] font-medium text-white"><MessageSquare className="size-3.5" /> Try now</span>
          </div>
          <div className="mt-1 text-zinc-600">Repositories, pull requests, issues and CI for every session.</div>
          <div className="mt-4 space-y-2 rounded-2xl bg-[radial-gradient(ellipse_at_70%_80%,#6d4fd8_0%,#2b2f5e_45%,#14162b_80%)] p-3">
            {["Review the open pull requests on billing-api and flag anything that touches payments", "Find every flaky test from the last 20 CI runs and open one issue per cause"].map((t, i) => (
              <div key={t} className={`flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[12.5px] ${i ? "text-white/60" : "text-white"}`}>
                <span className="font-medium text-sky-400">GitHub</span> <span className="truncate">{t}</span>
                <span className="ml-auto grid size-5 shrink-0 place-items-center rounded-full bg-white/10"><ArrowRight className="size-3" /></span>
              </div>
            ))}
          </div>
          <div className="mt-4 font-medium">Skills</div>
          <div className="mt-1.5 text-[12.5px]">review-pull-request</div>
          <div className="text-[12px] text-zinc-500">Check out the branch, run the tests, and leave review comments in the team's style.</div>
        </div>
      </div>
    </div>
  )
}

export function SelectionHandles() {
  return (
    <span className="pointer-events-none absolute -inset-1.5 rounded-[8px] border-[1.5px] border-[#8d7af6]">
      {["-top-1.5 -left-1.5", "-top-1.5 -right-1.5", "-bottom-1.5 -left-1.5", "-bottom-1.5 -right-1.5"].map((c) => (
        <span key={c} className={`absolute size-2.5 rounded-[2px] border-[1.5px] border-[#8d7af6] bg-white ${c}`} />
      ))}
    </span>
  )
}

/* ------------------------------------------------------------------ phone */

function PhoneTop({ title, back }: { title: ReactNode; back?: boolean }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-zinc-200 px-4 pt-2 text-[15px] font-medium text-zinc-900">
      {back ? <ArrowLeft className="size-5 text-zinc-500" strokeWidth={1.6} /> : <AtmosLogo className="size-5" />}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {!back && <SquarePen className="size-5 text-zinc-500" strokeWidth={1.6} />}
    </div>
  )
}

export function PhoneSessions({ pressed }: { pressed?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col bg-white text-[14px] text-zinc-900">
      <PhoneTop title="Sessions" />
      <div className="flex h-10 items-center gap-2 px-4 text-zinc-400"><Search className="size-4" strokeWidth={1.6} /> Search…</div>
      <div className="space-y-1 px-2">
        {SIDEBAR_SESSIONS.map((s, i) => (
          <div key={s.title} className={`flex h-[58px] items-center gap-3 rounded-xl px-3 transition-colors ${pressed && i === 0 ? "bg-zinc-100 ring-1 ring-zinc-300" : ""}`}>
            <Harness kind={s.harness} className="size-7" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[12px] text-zinc-500">{s.project}</div>
              <div className="truncate">{s.title}</div>
            </div>
            <span className="flex -space-x-1.5">
              {s.people.map((p) => (
                <Face key={p} who={p} className="size-6 ring-2 ring-white" />
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 px-4 text-[12.5px] text-zinc-500">Teams</div>
      {(["Platform", "Design", "Growth"] as const).map((t) => (
        <div key={t} className="flex h-10 items-center gap-3 px-4">
          <TeamShape team={t} /> {t}
        </div>
      ))}
    </div>
  )
}

export function PhoneSession({ pressed }: { pressed?: boolean }) {
  return (
    <div className="relative flex h-full w-full flex-col bg-white">
      <PhoneTop title="Event-sourced billing ledger" back />
      <div className="space-y-5 px-4 pt-4">
        <Msg avatar={<Thomas />} name="Thomas" time="10:02 AM">
          <p>4 of 6 billing incidents trace back to <Code>ApplyPayment</Code>. Claude, move balances behind one writer.</p>
        </Msg>
        <Msg avatar={<Harness kind="claude" />} name="Claude Code" time="10:04 AM">
          <div className="text-zinc-500">Worked for 2m 41s</div>
          <Step verb="Edited" file="ledger/writer.go" plus={64} minus={0} />
          <p>Balances now have one writer. The replay needs more than a laptop.</p>
        </Msg>
      </div>
      <div className="absolute inset-x-4 bottom-[104px]">
        <div className={`flex h-12 items-center justify-center rounded-xl text-[14px] font-medium text-white transition-colors ${pressed ? "bg-zinc-600" : "bg-zinc-900"}`}>Book machine</div>
      </div>
      <div className="absolute inset-x-4 bottom-4">
        <Composer phone />
      </div>
    </div>
  )
}

export function PhoneBookMachine({ revised, payStyle, paySelected }: BookMachineProps) {
  return (
    <div className="relative flex h-full w-full flex-col bg-white text-zinc-900">
      <PhoneTop title="Book a cloud machine" back />
      <div className="px-5 pt-4">
        <div className="text-[12.5px] text-zinc-500">Operating system</div>
        <div className="mt-2 flex gap-2.5">
          <Tile on><OsMark os="linux" /><div className="mt-1.5">Linux</div></Tile>
          <Tile><OsMark os="windows" /><div className="mt-1.5">Windows</div></Tile>
        </div>
        <div className="mt-4 text-[12.5px] text-zinc-500">Type</div>
        <div className="mt-2 flex gap-2.5">
          <Tile>Headless</Tile>
          <Tile on>Desktop</Tile>
        </div>
        <div className="mt-4 text-[12.5px] text-zinc-500">Size</div>
        <SizeSlider />
      </div>
      <div className="absolute inset-x-5 top-[356px]">
        <Stats revised={revised} />
      </div>
      <div className="absolute inset-x-5 top-[466px] text-[12.5px] text-zinc-500">
        Machines
        {MACHINES.slice(0, 2).map(([name, spec, ready]) => (
          <div key={name} className="mt-3 flex items-center gap-3 text-[13px] text-zinc-900">
            <Laptop className="size-4 text-zinc-700" strokeWidth={1.6} />
            <div className="min-w-0 flex-1 leading-tight">
              <div>{name}</div>
              <div className="text-[11.5px] text-zinc-500">{spec}</div>
            </div>
            <span className={`size-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-zinc-300"}`} />
          </div>
        ))}
      </div>
      {revised ? (
        <div className="absolute inset-x-5 bottom-7 flex h-11 items-center justify-center rounded-xl bg-zinc-950 text-[14px] font-medium text-white">Book machine</div>
      ) : (
        <div className="absolute bottom-7 left-5 w-[150px] transition-[width] duration-700 ease-[cubic-bezier(.32,.72,0,1)]" style={payStyle}>
          <div className="flex h-11 items-center justify-center rounded-xl bg-zinc-950 text-[14px] font-medium text-white">Book machine</div>
          {paySelected && <SelectionHandles />}
        </div>
      )}
    </div>
  )
}

export function PhoneReplay() {
  return (
    <div className="relative flex h-full w-full flex-col bg-white">
      <PhoneTop title="Event-sourced billing ledger" back />
      <div className="space-y-5 px-4 pt-4">
        <Msg avatar={<Harness kind="claude" />} name="Claude Code" time="10:09 AM">
          <p>Booted <Code>staging-ledger</Code>. Replaying Tuesday's snapshot:</p>
          <Bars />
        </Msg>
        <Msg avatar={<Face who="dani" />} name="Dani" time="10:12 AM">
          <p>Ship the writer behind a flag.</p>
        </Msg>
      </div>
      <div className="absolute inset-x-4 bottom-4">
        <Composer machine="staging-ledger" phone />
      </div>
    </div>
  )
}

export function PhonePlugins() {
  return (
    <div className="flex h-full w-full flex-col bg-white text-[14px] text-zinc-900">
      <PhoneTop title="GitHub" back />
      <div className="px-5 pt-5">
        <img src="/integrations/github.svg" alt="" className="size-10" />
        <div className="mt-2 text-[22px] font-semibold tracking-tight">GitHub</div>
        <div className="mt-1 text-zinc-600">Repositories, pull requests, issues and CI for every session.</div>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 px-3 py-2 text-[13px] font-medium text-white"><MessageSquare className="size-3.5" /> Try now</div>
        <div className="mt-4 space-y-2 rounded-2xl bg-[radial-gradient(ellipse_at_70%_80%,#6d4fd8_0%,#2b2f5e_45%,#14162b_80%)] p-3">
          {["Review the open pull requests on billing-api", "Find every flaky test from the last 20 CI runs"].map((t, i) => (
            <div key={t} className={`rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[13px] ${i ? "text-white/60" : "text-white"}`}>
              <span className="font-medium text-sky-400">GitHub</span> {t}
            </div>
          ))}
        </div>
        <div className="mt-5 font-medium">Skills</div>
        <div className="mt-1.5 text-[13px]">review-pull-request</div>
        <div className="text-[12.5px] text-zinc-500">Check out the branch, run the tests, and leave review comments in the team's style.</div>
      </div>
    </div>
  )
}
