import type { PostHog } from "posthog-js"

// PostHog behind consent, the same contract as the landing page (site/src/lib/analytics.ts): nothing loads until
// the visitor accepts. The choice lives in the sb_consent cookie on .stageboard.design, so the landing page and
// the docs share it. No key, no analytics and no banner.

export const POSTHOG_KEY = (process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").trim()
export const POSTHOG_HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com").trim()

export type Consent = "granted" | "denied"

const CONSENT_COOKIE = "sb_consent"
const POSTHOG_PREFIXES = ["ph_", "__ph_"]

let client: PostHog | null = null
let consented = false

function sharedDomain(): string {
  return location.hostname.endsWith("stageboard.design") ? "; Domain=.stageboard.design" : ""
}

export function readConsent(): Consent | undefined {
  const value = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.split("=")[1]
  return value === "granted" || value === "denied" ? value : undefined
}

export function writeConsent(consent: Consent) {
  document.cookie = `${CONSENT_COOKIE}=${consent}; Max-Age=31536000; Path=/; SameSite=Lax${sharedDomain()}`
  if (consent === "granted") void startAnalytics()
  else stopAnalytics()
}

export async function startAnalytics(): Promise<void> {
  if (!POSTHOG_KEY) return
  consented = true
  if (client) {
    client.opt_in_capturing()
    return
  }
  const { default: posthog } = await import("posthog-js")
  if (!consented) return
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: "history_change",
    cross_subdomain_cookie: true,
    persistence: "localStorage+cookie",
    disable_session_recording: true,
    respect_dnt: true,
    before_send: (event) => (consented ? event : null),
  })
  if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing({ captureEventName: false })
  client = posthog
}

/** Opts out and removes PostHog's cookies (current host and every parent domain) and storage keys. */
export function stopAnalytics() {
  consented = false
  const wasRunning = client !== null
  client?.opt_out_capturing()
  for (const storage of [localStorage, sessionStorage])
    for (const key of Object.keys(storage)) if (POSTHOG_PREFIXES.some((p) => key.startsWith(p))) storage.removeItem(key)
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=", 1)[0].trim())
    .filter((n) => POSTHOG_PREFIXES.some((p) => n.startsWith(p)))
  const labels = location.hostname.split(".")
  const domains = ["", ...labels.slice(1).map((_, i) => `; Domain=.${labels.slice(i).join(".")}`)]
  for (const name of names) for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/${domain}`
  // A revoke while PostHog was running: reload so nothing of it stays in memory.
  if (wasRunning) location.reload()
}

/** Starts analytics on load when the visitor already accepted. */
export function resumeAnalytics() {
  if (readConsent() === "granted") void startAnalytics()
}
