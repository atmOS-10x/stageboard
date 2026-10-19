import { POSTHOG_HOST } from "./lib/analytics"
import { openCookieSettings } from "./components/consent-banner"
import { Field, LegalPage, LegalSection, TextLink } from "./legal"

// Adapted from atmos.build/legal/privacy (atmos packages/@atmos/i18n legal.privacy) for stageboard.design and
// docs.stageboard.design, which are hosted on Vercel and use PostHog without session recording.

const UPDATED = "19 October 2026"

const STORED = [
  ["sb_consent (cookie)", "Remembers whether you accepted or declined analytics, so we stop asking.", "12 months", "Art. 6(1)(f) GDPR, honouring your choice"],
  ["PostHog cookie and local storage (ph_…)", "Recognises your browser across pages so one visit is counted once.", "12 months", "Art. 6(1)(a) GDPR, your consent"],
]

export function Privacy() {
  return (
    <LegalPage title="Privacy" summary={`How stageboard.design and docs.stageboard.design handle personal data. Last updated ${UPDATED}.`}>
      <LegalSection heading="Controller">
        <p>atmOS GmbH, Aichelberger Straße 12, 73271 Holzmaden, Germany, decides why and how personal data is processed on these websites, and is the controller within the meaning of Art. 4(7) GDPR.</p>
        <Field label="Privacy contact"><TextLink href="mailto:privacy@atmos.build">privacy@atmos.build</TextLink></Field>
      </LegalSection>
      <LegalSection heading="What this notice covers">
        <p>This notice covers stageboard.design and docs.stageboard.design. stageboard itself is open-source software that runs on your own machine; it sends nothing to us.</p>
      </LegalSection>
      <LegalSection heading="Reading the site">
        <p>Our host records a line every time your browser asks for a page: IP address, time, the page requested, referrer and user agent. That is what makes serving a website possible.</p>
        <p>The sites are served by Vercel Inc. We do not combine these logs with anything else and do not use them to identify you. The legal basis is our legitimate interest in operating and securing the site (Art. 6(1)(f) GDPR).</p>
        <p>The landing page asks GitHub for the repository's star count from your browser, which sends your IP address to GitHub, Inc.</p>
      </LegalSection>
      <LegalSection heading="What is stored on your device">
        <p>Nothing is written to your device until you act. This is the whole list.</p>
        <div className="space-y-1.5 text-[13.5px]">
          {STORED.map(([name, purpose, retention, basis]) => (
            <div key={name} className="grid gap-1 rounded-xl bg-white/4 p-3.5 sm:grid-cols-[1fr_1.4fr]">
              <span className="font-medium text-fg">{name}</span>
              <span>
                {purpose} <span className="text-fg-dim">Kept {retention.toLowerCase()}. {basis}.</span>
              </span>
            </div>
          ))}
        </div>
        <p>
          You can change your mind at any time through{" "}
          <button type="button" onClick={openCookieSettings} className="text-fg underline decoration-white/20 underline-offset-3 hover:decoration-white/60">
            cookie settings
          </button>
          . Declining stops analytics straight away and removes the PostHog cookies and local storage entries.
        </p>
      </LegalSection>
      <LegalSection heading="Analytics">
        <p>
          If you accept, we load PostHog and send page views and the clicks PostHog captures automatically to {POSTHOG_HOST.replace("https://", "")}. PostHog processes the data in the EU on our
          behalf under a data processing agreement. We do not record sessions.
        </p>
        <p>Nothing loads until you accept. Decline and posthog-js is never fetched, no identifier is written and no event leaves your browser.</p>
      </LegalSection>
      <LegalSection heading="Who else sees the data">
        <Field label="Vercel Inc.">Serves the sites and keeps the request logs described above.</Field>
        <Field label="PostHog, Inc. (EU Cloud)">Processes analytics events in the EU, and only after you accept.</Field>
        <Field label="GitHub, Inc.">Answers the star count request on the landing page.</Field>
      </LegalSection>
      <LegalSection heading="How long we keep it">
        <p>Server logs live as long as our host keeps them. Analytics events are kept for 12 months and then deleted.</p>
      </LegalSection>
      <LegalSection heading="Your rights">
        <p>Under the GDPR you can ask us to tell you what personal data we hold about you (Art. 15), correct it (Art. 16), delete it (Art. 17), restrict how we process it (Art. 18), hand it to you in a portable format (Art. 20), stop processing that rests on legitimate interest (Art. 21), and honour a withdrawn consent from that point on (Art. 7(3)).</p>
        <p>
          Write to <TextLink href="mailto:privacy@atmos.build">privacy@atmos.build</TextLink> and we answer within a month. You can also complain to a supervisory authority. For us that is the
          Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg.
        </p>
      </LegalSection>
      <LegalSection heading="Changes to this notice">
        <p>When the sites change, this notice changes with it. The date at the top tells you which version you are reading.</p>
      </LegalSection>
    </LegalPage>
  )
}
