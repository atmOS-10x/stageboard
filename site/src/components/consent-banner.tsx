import { useEffect, useState } from "react"
import { POSTHOG_KEY, readConsent, resumeAnalytics, writeConsent } from "../lib/analytics"

const OPEN_EVENT = "sb:cookie-settings"

/** Reopens the banner, for the footer's Cookie settings link. */
export function openCookieSettings() {
  dispatchEvent(new Event(OPEN_EVENT))
}

export function ConsentBanner() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!POSTHOG_KEY) return
    resumeAnalytics()
    if (!readConsent()) setOpen(true)
    const reopen = () => setOpen(true)
    addEventListener(OPEN_EVENT, reopen)
    return () => removeEventListener(OPEN_EVENT, reopen)
  }, [])

  if (!open) return null
  const choose = (granted: boolean) => {
    writeConsent(granted ? "granted" : "denied")
    setOpen(false)
  }
  return (
    <div
      role="dialog"
      aria-label="Cookie settings"
      className="animate-rise fixed inset-x-3 bottom-3 z-50 rounded-2xl bg-[#28282e]/97 p-4 text-[13.5px] leading-relaxed text-fg-soft shadow-[0_20px_60px_rgb(0_0_0/0.55),0_0_0_1px_rgb(255_255_255/0.08)] backdrop-blur-md sm:right-auto sm:bottom-5 sm:left-5 sm:w-[360px]"
    >
      <p>
        We use PostHog to see how the site is used. It sets cookies only if you accept.{" "}
        <a href="/privacy" className="text-fg underline decoration-white/25 underline-offset-3 hover:decoration-white/60">
          Privacy
        </a>
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => choose(false)} className="h-8 rounded-full px-3.5 text-[13px] font-medium text-fg-dim transition-colors hover:bg-white/7 hover:text-fg">
          Decline
        </button>
        <button type="button" onClick={() => choose(true)} className="h-8 rounded-full bg-[#ebebf0] px-3.5 text-[13px] font-medium text-[#16161b] transition-colors hover:bg-white">
          Accept
        </button>
      </div>
    </div>
  )
}
