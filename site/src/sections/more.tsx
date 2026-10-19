import { variant } from "@atmos.build/stageboard/react"
import { PenTool } from "lucide-react"
import { BrandMark, Wordmark } from "../components/brand"
import { CheckDisc, CrossDisc } from "../components/discs"
import { CopyPromptButton, SETUP_PROMPT } from "../components/copy-prompt"
import { PixelWaves } from "../components/pixel-waves"
import { AtmosLogo } from "../components/agent-logos"
import { openCookieSettings } from "../components/consent-banner"
import { GitHubStar } from "../components/github-star"
import { POSTHOG_KEY } from "../lib/analytics"
import { DOCS_URL, GITHUB_URL, GitHubIcon } from "./hero"

export const ATMOS_URL = "https://atmos.build"

export function AtmosLink() {
  return (
    <a href={ATMOS_URL} className="text-lilac underline decoration-lilac/30 underline-offset-3 transition-colors hover:decoration-lilac">
      atmOS
    </a>
  )
}

const ROWS = [
  ["What you design on", "A drawing of your app", "Your app, rendered from its own components"],
  ["Real states", "Recreated by hand, per frame", "Stories with mock data: empty, loading, error, long names"],
  ["User journeys", "Arrows between frames", "Flows you can click through, step by step"],
  ["Getting it into code", "Export, hand off, re-implement", "Nothing to do. The agent already changed the component"],
  ["Drift", "The file and the app diverge", "There is only one source: the code"],
]

function CompareImpl() {
  return (
    <section id="code" className="scroll-mt-20 bg-ink-850">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:py-32">
        <div className="max-w-2xl">
          <p className="text-[13px] font-medium text-lilac">Not a canvas next to your code</p>
          <h2 className="mt-3 text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] text-balance text-white sm:text-[46px]">No round trip. The board is your code.</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-pretty text-fg-dim">
            Design canvases are learning to talk to code. stageboard skips the translation: what you point at is the component that ships.
          </p>
        </div>
        <div className="mt-12 overflow-hidden rounded-2xl bg-ink-900/50">
          <div className="grid grid-cols-2 text-[13.5px] font-medium sm:grid-cols-[0.8fr_1fr_1.2fr]">
            <span className="hidden px-5 py-4 sm:block" />
            <span className="flex items-center gap-2.5 px-5 py-4 text-fg-dim">
              <span className="grid size-7 place-items-center rounded-lg bg-white/6 text-fg-dim"><PenTool className="size-3.5" /></span>
              Design canvas
            </span>
            <span className="flex items-center gap-2.5 bg-accent/8 px-5 py-4 text-white">
              <BrandMark className="size-7" />
              stageboard
            </span>
          </div>
          {ROWS.map(([label, canvas, ours]) => (
            <div key={label} className="grid grid-cols-2 text-[14.5px] sm:grid-cols-[0.8fr_1fr_1.2fr]">
              <span className="col-span-2 px-5 pt-4 text-[13px] font-medium text-fg-soft sm:col-span-1 sm:py-4">{label}</span>
              <span className="flex items-start gap-3 px-5 py-4 text-fg-faint">
                <CrossDisc className="mt-0.5 size-[18px] text-white/12" />
                {canvas}
              </span>
              <span className="flex items-start gap-3 bg-accent/8 px-5 py-4 text-fg">
                <CheckDisc className="mt-0.5 size-[18px] text-accent-soft" />
                {ours}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export const Compare = variant("landing.compare", CompareImpl)

const TOOLS = [
  { title: "stageboard shot", body: "A headless PNG of any story, variant or region, so the agent checks its own work before it tells you it's done.", code: "npx stageboard shot pages-checkout --width 390" },
  { title: "flow shot", body: "A whole journey in one grid image, with each step's note and action, for an agent to take in at once.", code: "npx stageboard flow shot book-a-cabin" },
  { title: "MCP server", body: "List stories, screenshot, compare and select variants, report when a job is done. Attached to Claude and Codex automatically.", code: "list_stories, screenshot, compare_variants" },
  { title: "Any agent", body: <>Claude Code, Codex, <AtmosLink />, or any CLI that reads a prompt file. Every request carries the region, a screenshot and the source paths.</>, code: "agent: { provider: \"claude\" }" },
]

function AgentsImpl() {
  return (
    <section id="agents" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:py-32">
      <div className="max-w-2xl">
        <p className="text-[13px] font-medium text-lilac">Built for agents</p>
        <h2 className="mt-3 text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] text-balance text-white sm:text-[46px]">Agents that can see what they built.</h2>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <div key={t.title} className="min-w-0 rounded-2xl border border-white/8 bg-ink-800 p-6 transition-colors hover:border-white/14">
            <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-white">{t.title}</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-fg-dim">{t.body}</p>
            <code className="mt-5 block truncate rounded-lg bg-black/30 px-3 py-2 font-mono text-[12px] text-lilac">{t.code}</code>
          </div>
        ))}
      </div>
    </section>
  )
}

export const Agents = variant("landing.agents", AgentsImpl)

function CallToActionImpl() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24">
      <div className="relative overflow-hidden rounded-3xl shadow-[0_0_0_1px_rgb(150_132_255/0.25),0_40px_100px_-30px_rgb(0_0_0/0.8)]">
        <div className="absolute inset-0">
          <PixelWaves cell={11} fps={40} />
        </div>
        <div className="relative flex flex-col items-center bg-[radial-gradient(ellipse_at_center,rgb(14_13_20/0.88)_0%,rgb(14_13_20/0.6)_55%,rgb(14_13_20/0.2)_100%)] px-6 py-20 text-center sm:py-24">
          <h2 className="max-w-[18ch] text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] text-balance text-white sm:text-[46px]">Put your app on the board.</h2>
          <p className="mt-4 max-w-[48ch] text-[16px] leading-relaxed text-[#c9c5df]">Paste this into Claude Code, Codex, Cursor or <AtmosLink />. It takes a few minutes, and the agent tells you which stories look weak.</p>
          <pre className="mt-8 max-w-2xl rounded-2xl bg-ink-900/80 p-5 text-left font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-fg-soft shadow-[0_0_0_1px_rgb(255_255_255/0.08)] backdrop-blur-sm">{SETUP_PROMPT}</pre>
          <div className="mt-8">
            <CopyPromptButton label="Copy prompt" />
          </div>
        </div>
      </div>
    </section>
  )
}

export const CallToAction = variant("landing.cta", CallToActionImpl)

function FooterImpl() {
  return (
    <footer>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-5 py-10 text-[13px] text-fg-dim">
        <Wordmark />
        <a href={ATMOS_URL} className="group inline-flex items-center gap-1.5 transition-colors hover:text-fg">
          by
          <span className="grid size-5 place-items-center rounded-md bg-[#09090b] text-[#fafafa] ring-1 ring-white/10">
            <AtmosLogo className="size-3" />
          </span>
          <span className="font-medium text-fg-soft group-hover:text-fg">atmOS</span>
        </a>
        <span>MIT licensed</span>
        <a href={DOCS_URL} className="transition-colors hover:text-fg">Docs</a>
        <a href="/privacy" className="transition-colors hover:text-fg">Privacy</a>
        <a href="/imprint" className="transition-colors hover:text-fg">Imprint</a>
        {POSTHOG_KEY && (
          <button type="button" onClick={openCookieSettings} className="transition-colors hover:text-fg">
            Cookie settings
          </button>
        )}
        <span className="flex-1" />
        <a href={GITHUB_URL} className="inline-flex items-center gap-2 transition-colors hover:text-fg">
          <GitHubIcon /> atmOS-10x/stageboard
        </a>
        <GitHubStar />
      </div>
    </footer>
  )
}

export const Footer = variant("landing.footer", FooterImpl)
