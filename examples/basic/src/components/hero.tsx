import { variant } from "@atmos.build/stageboard/react"
import { Button } from "./button"

export type HeroProps = { title: string; subtitle: string; cta: string }

function HeroImpl({ title, subtitle, cta }: HeroProps) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="text-5xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-4 text-lg text-zinc-600">{subtitle}</p>
      <Button className="mt-8">{cta}</Button>
    </section>
  )
}

export const Hero = variant("home.hero", HeroImpl)
