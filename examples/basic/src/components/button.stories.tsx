import type { Meta, Story } from "stageboard"
import { Button } from "./button"

export default { title: "Primitives/Button", component: Button, args: { children: "Click me" } } satisfies Meta<typeof Button>

export const Primary: Story<typeof Button> = {}
export const Wide: Story<typeof Button> = { args: { className: "w-64" } }
