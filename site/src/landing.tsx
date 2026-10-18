import { ConsentBanner } from "./components/consent-banner"
import { Hero, Nav } from "./sections/hero"
import { Agents, CallToAction, Compare, Footer } from "./sections/more"
import { Workflow } from "./sections/workflow"

export function Landing() {
  return (
    <div className="min-h-screen overflow-x-clip bg-ink-900">
      <Nav />
      <main>
        <Hero />
        <Workflow />
        <Compare />
        <Agents />
        <CallToAction />
      </main>
      <Footer />
      <ConsentBanner />
    </div>
  )
}
