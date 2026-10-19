import { useEffect, useState } from "react"
import { AtmosLogo, ClaudeLogo, CursorLogo, OpenAILogo } from "./agent-logos"

export const SETUP_PROMPT = [
  "Set up stageboard in this repo. Run `npm i -D @atmos.build/stageboard` (use this repo's package manager), then",
  "`npx stageboard skill` to install the stageboard skill, and follow it: write the config and a preview",
  "with mock providers, add stories for the main components, put every page in Screens with realistic",
  "mock data, and check each one with `npx stageboard shot`. Finish by listing the stories that look weak.",
].join(" ")

const AGENTS = [
  { name: "Claude", Logo: ClaudeLogo, tone: "bg-[#f4efe6] text-[#d97757]" },
  { name: "ChatGPT", Logo: OpenAILogo, tone: "bg-white text-black" },
  { name: "Cursor", Logo: CursorLogo, tone: "bg-black text-white" },
  { name: "atmOS", Logo: AtmosLogo, tone: "bg-[#09090b] text-[#fafafa]" },
]

export function AgentStack({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-6" : "size-7"
  const icon = size === "sm" ? "size-3.5" : "size-4"
  return (
    <span className="flex -space-x-1.5" aria-label="Works with Claude, ChatGPT, Cursor and atmOS">
      {AGENTS.map(({ name, Logo, tone }) => (
        <span key={name} title={name} className={`grid ${box} place-items-center rounded-full ring-2 ring-ink-800 ${tone}`}>
          <Logo className={icon} />
        </span>
      ))}
    </span>
  )
}

export type CopyPromptButtonProps = {
  label?: string
  /** Shown on phones, where the full label would wrap. */
  shortLabel?: string
  prompt?: string
  size?: "md" | "lg"
}

// The one call to action: copies the setup prompt for your agent. A light runs around the pill's border.
export function CopyPromptButton({ label = "Copy prompt for your agent", shortLabel = "Copy prompt", prompt = SETUP_PROMPT, size = "lg" }: CopyPromptButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 2200)
    return () => clearTimeout(id)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      const area = Object.assign(document.createElement("textarea"), { value: prompt })
      document.body.append(area)
      area.select()
      document.execCommand("copy")
      area.remove()
    }
    setCopied(true)
  }

  const height = size === "lg" ? "h-13 pl-2.5 pr-5 text-[15px]" : "h-11 pl-2 pr-4 text-sm"

  return (
    <button
      type="button"
      onClick={copy}
      className={`shine-border group inline-flex items-center gap-3 rounded-full bg-ink-800 font-medium text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_12px_40px_-8px_rgb(141_122_246/0.45)] transition-[background-color,transform] duration-150 hover:bg-ink-600 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft ${height}`}
    >
      <AgentStack size={size === "lg" ? "md" : "sm"} />
      <span className="relative grid">
        <span className={`col-start-1 row-start-1 whitespace-nowrap transition-opacity duration-150 ${copied ? "opacity-0" : ""}`}>
          <span className="sm:hidden">{shortLabel}</span>
          <span className="max-sm:hidden">{label}</span>
        </span>
        <span className={`col-start-1 row-start-1 whitespace-nowrap text-lilac transition-opacity duration-150 ${copied ? "" : "opacity-0"}`} aria-live="polite">
          {copied ? <><span className="sm:hidden">Copied</span><span className="max-sm:hidden">Copied. Paste it into your agent</span></> : ""}
        </span>
      </span>
      <span className="grid size-5 place-items-center text-fg-dim transition-colors group-hover:text-fg">{copied ? <CheckIcon /> : <CopyIcon />}</span>
    </button>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="3" />
      <path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 text-lilac" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
