import { Hero } from "../components/hero"
import { Button } from "../components/button"

function Nav() {
  return (
    <nav className="flex items-center justify-between border-b border-zinc-200 px-8 py-4">
      <a href="/" className="font-semibold">Acme</a>
      <div className="flex gap-6 text-sm text-zinc-600">
        <a href="/pricing">Pricing</a>
        <a href="/login">Log in</a>
      </div>
    </nav>
  )
}

export function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <Hero title="Ship calmer software" subtitle="Everything your team needs, nothing it doesn't." cta="Start free" />
    </div>
  )
}

export function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="mx-auto grid max-w-4xl grid-cols-3 gap-6 px-6 py-20">
        {["Starter", "Team", "Enterprise"].map((plan, i) => (
          <div key={plan} className="rounded-2xl border border-zinc-200 p-6">
            <h3 className="font-semibold">{plan}</h3>
            <p className="mt-2 text-3xl font-semibold">{["$0", "$29", "Talk to us"][i]}</p>
            <Button className="mt-6 w-full">Choose</Button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-zinc-50">
      <form className="w-80 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Welcome back</h2>
        <input className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2" placeholder="Email" />
        <Button className="mt-4 w-full">Continue</Button>
      </form>
    </div>
  )
}
