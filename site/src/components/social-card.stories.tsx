import type { Meta, Story } from "stageboard"
import { SocialCard } from "./social-card"

export default { title: "Landing/Social", parameters: { layout: "fullscreen" } } satisfies Meta

export const Card: Story = { render: () => <SocialCard /> }
