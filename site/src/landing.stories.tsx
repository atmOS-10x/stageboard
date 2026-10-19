import type { Meta, Story } from "@atmos.build/stageboard"
import { Imprint } from "./imprint"
import { Landing } from "./landing"
import { Privacy } from "./privacy"

export default { title: "Pages", parameters: { layout: "fullscreen" } } satisfies Meta

export const Home: Story = { render: () => <Landing />, parameters: { page: { route: "/", title: "Landing" } } }
export const ImprintPage: Story = { render: () => <Imprint />, parameters: { page: { route: "/imprint", title: "Imprint" } } }
export const PrivacyPage: Story = { render: () => <Privacy />, parameters: { page: { route: "/privacy", title: "Privacy" } } }
