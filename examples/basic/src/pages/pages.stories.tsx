import type { Meta, Story } from "@atmos.build/stageboard"
import { HomePage, LoginPage, PricingPage } from "./pages"

export default { title: "Pages", parameters: { layout: "fullscreen" } } satisfies Meta

export const Home: Story = { render: () => <HomePage />, parameters: { page: { route: "/", title: "Home", links: ["/pricing", "/login"] } } }
export const Pricing: Story = { render: () => <PricingPage />, parameters: { page: { route: "/pricing", title: "Pricing", links: ["/login"] } } }
export const Login: Story = { render: () => <LoginPage />, parameters: { page: { route: "/login", title: "Log in" } } }
