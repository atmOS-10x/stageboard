import { variant } from "stageboard/react"
import { FlowsDemo } from "../components/demos"
import { Wordmark } from "../components/brand"
import { CopyPromptButton } from "../components/copy-prompt"
import { HeroBackdrop } from "../components/hero-backdrop"
import { GitHubStar } from "../components/github-star"

export const GITHUB_URL = "https://github.com/atmOS-10x/stageboard"
export const DOCS_URL = "https://docs.stageboard.design"

function NavImpl() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/6 bg-ink-900/75 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-5">
        <a href="/" className="rounded-md focus-visible:outline-2 focus-visible:outline-accent-soft">
          <Wordmark />
        </a>
        <nav className="hidden items-center gap-6 text-[13.5px] font-medium text-fg-dim md:flex">
          {[
            ["How it works", "/#how"],
            ["Not a canvas", "/#code"],
            ["For agents", "/#agents"],
            ["Docs", DOCS_URL],
          ].map(([label, href]) => (
            <a key={href} href={href} className="transition-colors hover:text-fg">
              {label}
            </a>
          ))}
        </nav>
        <span className="flex-1" />
        <GitHubStar />
        <a href="/#start" className="hidden h-8 items-center rounded-full bg-[#ebebf0] px-3.5 text-[13px] font-medium text-[#16161b] transition-colors hover:bg-white sm:inline-flex">
          Get started
        </a>
      </div>
    </header>
  )
}

export const Nav = variant("landing.nav", NavImpl)

export type HeroProps = { title?: string; subtitle?: string }

function HeroImpl({
  title = "Design your app where it lives: in the code.",
  subtitle = "Every screen and flow of your app on one board. Point at what's wrong, your agent fixes the code.",
}: HeroProps) {
  return (
    <section id="top" className="relative isolate overflow-hidden">
      <HeroBackdrop />
      <div className="relative mx-auto max-w-6xl px-5 pt-20 text-center sm:pt-28">
        <a href="#how" className="animate-rise inline-flex items-center gap-2 rounded-full bg-white/6 py-1 pr-3 pl-1 text-[12.5px] text-fg-soft transition-colors hover:bg-white/10">
          <span className="rounded-full bg-accent/20 px-2 py-0.5 font-medium text-lilac">New</span>
          Flows: describe a journey, watch the missing screens get built
        </a>
        <h1 className="animate-rise mx-auto mt-6 max-w-[15ch] text-[44px] leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-white [animation-delay:60ms] sm:text-[68px]">
          {title}
        </h1>
        <p className="animate-rise mx-auto mt-6 max-w-[46ch] text-[17px] leading-relaxed text-pretty text-fg-dim [animation-delay:120ms] sm:text-[18px]">{subtitle}</p>
        <div id="start" className="animate-rise mt-9 flex scroll-mt-28 flex-col items-center gap-3 [animation-delay:180ms]">
          <CopyPromptButton />
        </div>
      </div>

      <div className="relative mt-16 sm:mt-20">
        <div className="animate-rise relative mx-auto max-w-6xl px-3 pb-24 [animation-delay:260ms] sm:px-5">
          <FlowsDemo />
        </div>
      </div>
    </section>
  )
}

export const Hero = variant("landing.hero", HeroImpl)

export function GitHubIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}
