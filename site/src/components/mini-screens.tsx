import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Cpu, HardDrive, MemoryStick, Mic, Plus, Search } from "lucide-react"
import { AtmosLogo, ClaudeLogo, OpenAILogo } from "./agent-logos"

// Screens of atmOS (atmos.build), the app the demos annotate, drawn at a fixed size and scaled to fit the way the
// board shows thumbnails. Content follows the atmos.build home page: the billing-ledger session, machine booking
// and the plugin catalog. Light theme, zinc neutrals, near-black primary, as in @atmos/ui.

export const SCREEN_W = 480
export const SCREEN_H = 300
export const PHONE_W = 240
export const PHONE_H = 500

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

/* ------------------------------------------------------------------ shared bits */

type Person = "dani" | "philipp" | "mara"

function Face({ who, className = "size-4" }: { who: Person; className?: string }) {
  return <img src={`/people/${who}.webp`} alt="" draggable={false} className={`shrink-0 rounded-full bg-zinc-200 object-cover ${className}`} />
}

function Harness({ kind, className = "size-4" }: { kind: "claude" | "codex"; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-zinc-100 ${className}`}>
      {kind === "claude" ? <ClaudeLogo className="size-[62%] text-[#d97757]" /> : <OpenAILogo className="size-[62%] text-zinc-900" />}
    </span>
  )
}

function Lights() {
  return (
    <span className="flex gap-1">
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <span key={c} className="size-[6px] rounded-full" style={{ background: c }} />
      ))}
    </span>
  )
}

function Mark({ className = "size-4" }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-[5px] bg-zinc-950 text-white ${className}`}>
      <AtmosLogo className="size-[62%]" />
    </span>
  )
}

const NAV = ["Sessions", "Machines", "Plugins"] as const

function Sidebar({ active }: { active: (typeof NAV)[number] }) {
  return (
    <div className="flex w-[108px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 px-2 pt-2.5 text-[9.5px] text-zinc-600">
      <div className="flex items-center gap-1.5 px-1 pb-2.5">
        <Lights />
      </div>
      <div className="flex items-center gap-1.5 rounded-md px-1.5 py-1 font-medium text-zinc-900">
        <Mark className="size-3.5" /> Platform
      </div>
      {NAV.map((n) => (
        <div key={n} className={`mt-0.5 rounded-md px-1.5 py-1 ${n === active ? "bg-zinc-200/70 font-medium text-zinc-900" : ""}`}>
          {n}
        </div>
      ))}
      <div className="mt-3 px-1.5 text-[8.5px] font-medium text-zinc-400">Teams</div>
      {["Design", "Growth"].map((t) => (
        <div key={t} className="px-1.5 py-1">
          {t}
        </div>
      ))}
    </div>
  )
}

function Top({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-zinc-200 px-4 text-[10.5px]">
      <span className="truncate font-medium text-zinc-900">{title}</span>
      <span className="flex-1" />
      {children}
    </div>
  )
}

function Composer({ value }: { value?: string }) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-2.5 text-[9.5px] shadow-sm">
      <Plus className="size-3 text-zinc-400" />
      <span className={`flex-1 truncate ${value ? "text-zinc-900" : "text-zinc-400"}`}>{value ?? "Mention skills with $ or browse commands with /"}</span>
      <Mic className="size-3 text-zinc-400" />
    </div>
  )
}

function Bubble({ who, name, time, children }: { who: Person | "claude"; name: string; time: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      {who === "claude" ? <Harness kind="claude" className="mt-px size-4" /> : <Face who={who} className="mt-px size-4" />}
      <div className="min-w-0 flex-1 leading-snug">
        <div className="flex items-baseline gap-1.5">
          <span className="font-medium text-zinc-900">{name}</span>
          <span className="text-[8px] text-zinc-400">{time}</span>
        </div>
        <div className="mt-0.5 text-zinc-700">{children}</div>
      </div>
    </div>
  )
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-zinc-100 px-1 font-mono text-[8.5px] text-zinc-800">{children}</code>
}

function Edited({ file, plus, minus }: { file: string; plus: number; minus: number }) {
  return (
    <div className="flex items-center gap-1.5 text-[8.5px] text-zinc-500">
      Edited <span className="font-mono text-zinc-800">{file}</span>
      <span className="text-emerald-600">+{plus}</span>
      <span className="text-rose-500">−{minus}</span>
    </div>
  )
}

const SESSIONS = [
  { project: "billing-api", title: "Event-sourced billing ledger", harness: "claude", people: ["dani", "philipp"], status: "" },
  { project: "billing-api", title: "Move invoice jobs to Temporal", harness: "codex", people: ["mara"], status: "" },
  { project: "web", title: "Fix the flaky checkout e2e test", harness: "claude", people: [], status: "4m" },
  { project: "infra", title: "NATS consumer backpressure", harness: "codex", people: ["philipp"], status: "" },
] as const

/* ------------------------------------------------------------------ desktop: 480 × 300 */

export function SessionsScreen({ pressed }: { pressed?: boolean }) {
  return (
    <div className="flex h-full w-full bg-white text-[10px] text-zinc-900">
      <Sidebar active="Sessions" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Top title="Sessions">
          <span className="flex h-5 w-28 items-center gap-1 rounded-md border border-zinc-200 px-1.5 text-[9px] text-zinc-400">
            <Search className="size-2.5" /> Search sessions
          </span>
          <span className="rounded-md bg-zinc-900 px-2 py-1 text-[9px] font-medium text-white">New session</span>
        </Top>
        <div className="space-y-1 p-2.5">
          {SESSIONS.map((s, i) => (
            <div key={s.title} className={`flex h-[42px] items-center gap-2.5 rounded-lg px-2.5 transition-colors ${pressed && i === 0 ? "bg-zinc-100 ring-1 ring-zinc-300" : i === 0 ? "bg-zinc-50" : ""}`}>
              <Harness kind={s.harness} className="size-5" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s.title}</div>
                <div className="font-mono text-[8.5px] text-zinc-500">{s.project}</div>
              </div>
              {s.status && <span className="text-[8.5px] text-zinc-500">{s.status}</span>}
              <span className="flex -space-x-1">
                {s.people.map((p) => (
                  <Face key={p} who={p} className="size-4 ring-2 ring-white" />
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SessionScreen({ pressed }: { pressed?: boolean }) {
  return (
    <div className="flex h-full w-full bg-white text-[9.5px] text-zinc-900">
      <Sidebar active="Sessions" />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Top title={<><span className="font-mono text-zinc-500">billing-api/</span> Event-sourced billing ledger</>}>
          <span className="flex -space-x-1">
            <Face who="dani" className="size-4 ring-2 ring-white" />
            <Face who="philipp" className="size-4 ring-2 ring-white" />
          </span>
        </Top>
        <div className="space-y-3 px-4 pt-3">
          <Bubble who="philipp" name="Philipp" time="10:02">
            Pulled 30 days of billing incidents. 4 of 6 trace back to the read-modify-write in <Code>ApplyPayment</Code>.
          </Bubble>
          <Bubble who="claude" name="Claude Code" time="10:04">
            <Edited file="ledger/writer.go" plus={64} minus={0} />
            <div className="mt-1">Balances now have one writer. Replaying Tuesday's snapshot needs a bigger machine.</div>
          </Bubble>
        </div>
        <div className="absolute inset-x-4 bottom-[52px] flex h-[30px] items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-[9px] text-zinc-600">
          <Cpu className="size-3 text-zinc-400" /> Runs on Dani's MacBook
          <span className="flex-1" />
          <span className={`rounded-md px-2.5 py-1 font-medium text-white transition-colors ${pressed ? "bg-zinc-700" : "bg-zinc-900"}`}>Book machine</span>
        </div>
        <div className="absolute inset-x-4 bottom-3">
          <Composer />
        </div>
      </div>
    </div>
  )
}

const SIZES = [
  ["Tiny", "1 vCPU", "2 GB"],
  ["Small", "2 vCPU", "4 GB"],
  ["Regular", "4 vCPU", "8 GB"],
  ["Large", "8 vCPU", "16 GB"],
] as const

export type BookMachineProps = {
  /** The design after the agent reconciled the sketch: the specs as one big line, one accent, a full-width button. */
  revised?: boolean
  payStyle?: CSSProperties
  paySelected?: boolean
}

function Choice({ options, on }: { options: string[]; on: number }) {
  return (
    <div className="mt-1 flex rounded-md bg-zinc-100 p-0.5 text-[9px]">
      {options.map((o, i) => (
        <span key={o} className={`flex-1 rounded-[5px] py-1 text-center ${i === on ? "bg-white font-medium text-zinc-900 shadow-sm" : "text-zinc-500"}`}>
          {o}
        </span>
      ))}
    </div>
  )
}

export function BookMachineScreen({ revised, payStyle, paySelected }: BookMachineProps) {
  return (
    <div className="flex h-full w-full flex-col bg-white text-[9.5px] text-zinc-900">
      <Top title="Book a cloud machine">
        <span className="text-[9px] text-zinc-400">Platform</span>
      </Top>
      <div className="relative flex-1">
        <div className="absolute top-3 left-5 w-[256px]">
          <div className="text-[8.5px] font-medium text-zinc-500">Operating system</div>
          <Choice options={["Linux", "Windows"]} on={0} />
          <div className="mt-2.5 text-[8.5px] font-medium text-zinc-500">Type</div>
          <Choice options={["Headless", "Desktop"]} on={0} />
          <div className="mt-2.5 text-[8.5px] font-medium text-zinc-500">Size</div>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {SIZES.map(([name, cpu], i) => (
              <div key={name} className={`rounded-md border px-1.5 py-1 ${i === 2 ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
                <div className="font-medium">{name}</div>
                <div className="text-[8px] text-zinc-500">{cpu}</div>
              </div>
            ))}
          </div>
        </div>
        {revised ? (
          <div className="absolute top-[192px] left-5 w-[256px] rounded-lg bg-zinc-900 py-2 text-center text-[10px] font-medium text-white">Book machine</div>
        ) : (
          <div className="absolute top-[192px] left-5 w-28 transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)]" style={payStyle}>
            <div className="rounded-md bg-violet-600 py-1.5 text-center text-[9.5px] font-medium text-white">Book machine</div>
            {paySelected && <SelectionHandles />}
          </div>
        )}
        {revised ? (
          <div className="absolute top-3 right-5 w-[160px] rounded-xl border border-zinc-200 p-3">
            <div className="flex items-center gap-1.5 font-medium">
              <Mark className="size-4" /> sap-ledger
            </div>
            <div className="mt-3 text-[8.5px] text-zinc-500">Regular, Linux, headless</div>
            <div className="mt-0.5 text-[18px] leading-tight font-semibold tracking-tight">4 vCPU</div>
            <div className="text-[9px] text-zinc-600">8 GB RAM, 160 GB disk</div>
            <div className="mt-3 text-[8.5px] text-zinc-500">Ready in about a minute</div>
          </div>
        ) : (
          <div className="absolute top-3 right-5 w-[160px] rounded-xl bg-zinc-50 p-3">
            <div className="flex items-center gap-1.5 font-medium">
              <Mark className="size-4" /> sap-ledger
              <span className="ml-auto rounded bg-sky-100 px-1 text-[7.5px] font-medium text-sky-700">Regular</span>
            </div>
            {[
              [Cpu, "CPU", "4 vCPU"],
              [MemoryStick, "Memory", "8 GB"],
              [HardDrive, "Disk", "160 GB"],
            ].map(([Icon, label, value]) => {
              const I = Icon as typeof Cpu
              return (
                <div key={label as string} className="mt-1.5 flex items-center gap-1.5 text-zinc-500">
                  <I className="size-2.5" /> {label as string}
                  <span className="ml-auto text-zinc-900">{value as string}</span>
                </div>
              )
            })}
            <div className="mt-2 flex justify-between border-t border-zinc-200 pt-1.5 font-semibold text-emerald-700">
              <span>Ready in</span>
              <span>~1 min</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function ReplayScreen() {
  return (
    <div className="flex h-full w-full bg-white text-[9.5px] text-zinc-900">
      <Sidebar active="Sessions" />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Top title={<><span className="font-mono text-zinc-500">billing-api/</span> Event-sourced billing ledger</>}>
          <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[8.5px] font-medium text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-500" /> sap-ledger
          </span>
        </Top>
        <div className="space-y-3 px-4 pt-3">
          <Bubble who="dani" name="Dani" time="10:06">
            Replay Tuesday's prod snapshot through it before we ship.
          </Bubble>
          <Bubble who="claude" name="Claude Code" time="10:07">
            Booted <Code>sap-ledger</Code>. Replaying 1.2M events now.
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full w-[62%] rounded-full bg-zinc-900" />
            </div>
            <div className="mt-1 flex justify-between text-[8px] text-zinc-500">
              <span>744k of 1.2M events</span>
              <span>balances match</span>
            </div>
          </Bubble>
        </div>
        <div className="absolute inset-x-4 bottom-3">
          <Composer />
        </div>
      </div>
    </div>
  )
}

const PLUGINS = [
  ["github", "GitHub", "Pull requests, issues and CI", true],
  ["linear", "Linear", "Issues, projects and cycles", true],
  ["sentry", "Sentry", "Errors and releases", false],
  ["notion", "Notion", "Pages and databases", false],
  ["figma", "Figma", "Files and comments", false],
  ["posthog", "PostHog", "Events and insights", false],
  ["slack", "Slack", "Channels and threads", false],
  ["gmail", "Gmail", "Mail, labels and drafts", false],
] as const

export function PluginsScreen() {
  return (
    <div className="flex h-full w-full bg-white text-[9.5px] text-zinc-900">
      <Sidebar active="Plugins" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Top title="Plugins">
          <span className="flex h-5 w-28 items-center gap-1 rounded-md border border-zinc-200 px-1.5 text-[9px] text-zinc-400">
            <Search className="size-2.5" /> Search plugins
          </span>
        </Top>
        <div className="grid grid-cols-2 gap-1.5 p-2.5">
          {PLUGINS.map(([slug, name, desc, on]) => (
            <div key={slug} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1.5">
              <img src={`/integrations/${slug}.svg`} alt="" className="size-4" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{name}</div>
                <div className="truncate text-[8px] text-zinc-500">{desc}</div>
              </div>
              {on && <span className="rounded bg-emerald-50 px-1 text-[7.5px] font-medium text-emerald-700">Connected</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SelectionHandles() {
  return (
    <span className="pointer-events-none absolute -inset-1 rounded-[6px] border border-[#8d7af6]">
      {["-top-1 -left-1", "-top-1 -right-1", "-bottom-1 -left-1", "-bottom-1 -right-1"].map((c) => (
        <span key={c} className={`absolute size-1.5 rounded-[1px] border border-[#8d7af6] bg-white ${c}`} />
      ))}
    </span>
  )
}

/* ------------------------------------------------------------------ phone: 240 × 500 */

function PhoneTop({ title, back }: { title: ReactNode; back?: boolean }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-200 px-3.5 pt-1 text-[11px] font-medium text-zinc-900">
      {back ? <span className="text-[15px] text-zinc-400">‹</span> : <Mark className="size-4" />}
      <span className="min-w-0 flex-1 truncate">{title}</span>
    </div>
  )
}

export function PhoneSessions({ pressed }: { pressed?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col bg-white text-[10px] text-zinc-900">
      <PhoneTop title="Sessions" />
      <div className="space-y-1.5 p-2.5">
        {SESSIONS.map((s, i) => (
          <div key={s.title} className={`flex h-[58px] items-center gap-2.5 rounded-xl px-3 transition-colors ${pressed && i === 0 ? "bg-zinc-100 ring-1 ring-zinc-300" : "bg-zinc-50"}`}>
            <Harness kind={s.harness} className="size-6" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{s.title}</div>
              <div className="font-mono text-[8.5px] text-zinc-500">{s.project}</div>
            </div>
            <span className="flex -space-x-1">
              {s.people.map((p) => (
                <Face key={p} who={p} className="size-4 ring-2 ring-zinc-50" />
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PhoneSession({ pressed }: { pressed?: boolean }) {
  return (
    <div className="relative flex h-full w-full flex-col bg-white text-[10px] text-zinc-900">
      <PhoneTop title="Event-sourced billing ledger" back />
      <div className="space-y-3.5 px-3.5 pt-3">
        <Bubble who="philipp" name="Philipp" time="10:02">
          4 of 6 billing incidents trace back to the read-modify-write in <Code>ApplyPayment</Code>.
        </Bubble>
        <Bubble who="claude" name="Claude Code" time="10:04">
          <Edited file="ledger/writer.go" plus={64} minus={0} />
          <div className="mt-1">Balances now have one writer. The replay needs a bigger machine.</div>
        </Bubble>
      </div>
      <div className="absolute inset-x-3.5 bottom-[60px]">
        <div className={`rounded-lg py-2.5 text-center text-[10.5px] font-medium text-white transition-colors ${pressed ? "bg-zinc-700" : "bg-zinc-900"}`}>Book machine</div>
      </div>
      <div className="absolute inset-x-3.5 bottom-4">
        <Composer />
      </div>
    </div>
  )
}

export function PhoneBookMachine({ revised, payStyle, paySelected }: BookMachineProps) {
  return (
    <div className="relative flex h-full w-full flex-col bg-white text-[10px] text-zinc-900">
      <PhoneTop title="Book a cloud machine" back />
      <div className="px-3.5 pt-1.5">
        {revised ? (
          <div className="rounded-xl border border-zinc-200 p-3">
            <div className="flex items-center gap-1.5 font-medium">
              <Mark className="size-4" /> sap-ledger
            </div>
            <div className="mt-2.5 text-[8.5px] text-zinc-500">Regular, Linux, headless</div>
            <div className="text-[19px] leading-tight font-semibold tracking-tight">4 vCPU</div>
            <div className="text-[9.5px] text-zinc-600">8 GB RAM, 160 GB disk</div>
          </div>
        ) : (
          <div className="rounded-xl bg-zinc-50 p-3">
            <div className="flex items-center gap-1.5 font-medium">
              <Mark className="size-4" /> sap-ledger
              <span className="ml-auto rounded bg-sky-100 px-1 text-[8px] font-medium text-sky-700">Regular</span>
            </div>
            <div className="mt-2 flex justify-between text-zinc-500"><span>CPU</span><span className="text-zinc-900">4 vCPU</span></div>
            <div className="flex justify-between text-zinc-500"><span>Memory</span><span className="text-zinc-900">8 GB</span></div>
            <div className="mt-1 flex justify-between border-t border-zinc-200 pt-1 font-semibold text-emerald-700"><span>Ready in</span><span>~1 min</span></div>
          </div>
        )}
        <div className="mt-3 text-[8.5px] font-medium text-zinc-500">Operating system</div>
        <Choice options={["Linux", "Windows"]} on={0} />
        <div className="mt-2.5 text-[8.5px] font-medium text-zinc-500">Type</div>
        <Choice options={["Headless", "Desktop"]} on={0} />
        <div className="mt-2.5 text-[8.5px] font-medium text-zinc-500">Size</div>
        <div className="mt-1 grid grid-cols-2 gap-1">
          {SIZES.map(([name, cpu, ram], i) => (
            <div key={name} className={`rounded-md border px-2 py-1.5 ${i === 2 ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
              <div className="font-medium">{name}</div>
              <div className="text-[8.5px] text-zinc-500">{cpu}, {ram}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-4 bottom-5">
        {revised ? (
          <div className="rounded-lg bg-zinc-900 py-2.5 text-center text-[11px] font-medium text-white">Book machine</div>
        ) : (
          <div className="relative w-28 transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)]" style={payStyle}>
            <div className="rounded-md bg-violet-600 py-2 text-center text-[10.5px] font-medium text-white">Book machine</div>
            {paySelected && <SelectionHandles />}
          </div>
        )}
      </div>
    </div>
  )
}

export function PhoneReplay() {
  return (
    <div className="relative flex h-full w-full flex-col bg-white text-[10px] text-zinc-900">
      <PhoneTop title="Event-sourced billing ledger" back />
      <div className="space-y-3.5 px-3.5 pt-3">
        <Bubble who="dani" name="Dani" time="10:06">
          Replay Tuesday's prod snapshot through it before we ship.
        </Bubble>
        <Bubble who="claude" name="Claude Code" time="10:07">
          Booted <Code>sap-ledger</Code>. Replaying 1.2M events now.
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full w-[62%] rounded-full bg-zinc-900" />
          </div>
          <div className="mt-1 text-[8.5px] text-zinc-500">744k of 1.2M events, balances match</div>
        </Bubble>
      </div>
      <div className="absolute inset-x-3.5 bottom-4">
        <Composer />
      </div>
    </div>
  )
}

export function PhonePlugins() {
  return (
    <div className="flex h-full w-full flex-col bg-white text-[10px] text-zinc-900">
      <PhoneTop title="Plugins" />
      <div className="space-y-1.5 p-2.5">
        {PLUGINS.slice(0, 7).map(([slug, name, desc, on]) => (
          <div key={slug} className="flex items-center gap-2.5 rounded-xl border border-zinc-200 px-3 py-2">
            <img src={`/integrations/${slug}.svg`} alt="" className="size-5" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{name}</div>
              <div className="truncate text-[8.5px] text-zinc-500">{desc}</div>
            </div>
            {on && <span className="rounded bg-emerald-50 px-1 text-[8px] font-medium text-emerald-700">Connected</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
