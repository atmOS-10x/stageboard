import type { HeroProps } from "./hero"
import { Button } from "./button"

export const variant = {
  of: "home.hero",
  label: "Split with panel",
  description: "Left-aligned copy with a tinted product panel on the right.",
}

export default function HeroSplit({ title, subtitle, cta }: HeroProps) {
  return (
    <section className="mx-auto grid max-w-5xl grid-cols-2 items-center gap-12 px-6 py-24">
      <div>
        <h1 className="text-5xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 text-lg text-zinc-600">{subtitle}</p>
        <Button className="mt-8">{cta}</Button>
      </div>
      <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200 ring-1 ring-zinc-200" />
    </section>
  )
}
