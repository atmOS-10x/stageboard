import { variant } from "stageboard/react"
import { BrandMark } from "./brand"
import { PluginsScreen, Scaled, SessionScreen, SessionsScreen } from "./mini-screens"
import { PixelWaves } from "./pixel-waves"

// The 1200 × 630 social preview. public/og.png is a screenshot of this story:
// npx stageboard shot landing-social--card --width 1200 --height 630, then copy it to public/og.png.

function SocialCardImpl() {
  const steps = [SessionsScreen, SessionScreen, PluginsScreen]
  return (
    <div className="relative h-[630px] w-[1200px] overflow-hidden bg-ink-900">
      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_75%_80%_at_70%_100%,#000_25%,transparent_75%)]">
        <PixelWaves cell={14} sea={false} intensity={0.7} />
      </div>
      <div className="relative flex h-full flex-col px-[72px] pt-[64px]">
        <div className="flex items-center gap-3 text-[28px] font-semibold tracking-[-0.01em] text-fg">
          <BrandMark className="size-11" /> stageboard
        </div>
        <h1 className="mt-10 max-w-[13ch] text-[76px] leading-[1] font-semibold tracking-[-0.04em] text-white">Design your app where it lives.</h1>
        <p className="mt-6 text-[26px] text-fg-dim">Every screen and flow on one board. Your agent fixes the code.</p>
      </div>
      <div className="absolute right-[-70px] bottom-[16px] flex w-[640px] rotate-[-4deg] gap-4">
        {steps.map((S, i) => (
          <div key={i} className={`w-[260px] shrink-0 overflow-hidden rounded-xl shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_30px_60px_rgb(0_0_0/0.6)] ${i === 2 ? "translate-y-6" : i === 1 ? "translate-y-3" : ""}`}>
            <Scaled><S /></Scaled>
          </div>
        ))}
      </div>
    </div>
  )
}

export const SocialCard = variant("landing.social-card", SocialCardImpl)
