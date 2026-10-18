import type { Meta, Story } from "stageboard"
import { Hero, Nav } from "./hero"
import { Agents, CallToAction, Compare, Footer } from "./more"
import { Workflow } from "./workflow"

export default { title: "Landing/Sections", parameters: { layout: "fullscreen" } } satisfies Meta

export const NavBar: Story = { render: () => <Nav /> }
export const HeroSection: Story = { render: () => <Hero /> }
export const HowItWorks: Story = { render: () => <Workflow /> }
export const NotACanvas: Story = { render: () => <Compare /> }
export const ForAgents: Story = { render: () => <Agents /> }
export const GetStarted: Story = { render: () => <CallToAction /> }
export const SiteFooter: Story = { render: () => <Footer /> }
