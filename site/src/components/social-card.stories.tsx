import type { Meta, Story } from "@atmos.build/stageboard"
import { SocialCard } from "./social-card"

export default { title: "Landing/Social", parameters: { layout: "fullscreen" } } satisfies Meta

export const Card: Story = { render: () => <SocialCard /> }
