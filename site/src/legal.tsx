import type { ReactNode } from "react"
import { ConsentBanner } from "./components/consent-banner"
import { Nav } from "./sections/hero"
import { Footer } from "./sections/more"

// The frame of the legal pages (imprint, privacy): the site's nav and footer around a narrow column.

export function LegalPage({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-900">
      <Nav />
      <main className="mx-auto max-w-2xl px-5 py-20 sm:py-28">
        <h1 className="text-[36px] font-semibold tracking-[-0.03em] text-white">{title}</h1>
        <p className="mt-2 text-[15px] text-fg-dim">{summary}</p>
        <div className="mt-12 space-y-9">{children}</div>
      </main>
      <Footer />
      <ConsentBanner />
    </div>
  )
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[13px] font-medium text-lilac">{heading}</h2>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-fg-soft">{children}</div>
    </section>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p>
      <span className="text-fg-dim">{label}: </span>
      <span className="text-fg">{children}</span>
    </p>
  )
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} rel="noreferrer" className="text-fg underline decoration-white/20 underline-offset-3 hover:decoration-white/60">
      {children}
    </a>
  )
}
