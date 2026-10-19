import { describe, expect, it } from "vitest"
import { frameFor, planFrames, writeFrames } from "./frames"

describe("frameFor", () => {
  it("pads what a story draws and keeps a minimum", () => {
    expect(frameFor({ width: 28, height: 28, overlay: false }, "attach-button.stories.tsx")).toEqual({ width: 120, height: 110 })
    expect(frameFor({ width: 792, height: 40, overlay: false }, "button.stories.tsx")).toEqual({ width: 880, height: 120 })
  })

  it("leaves room for what a trigger opens", () => {
    expect(frameFor({ width: 100, height: 32, overlay: false }, "dropdown-menu.stories.tsx")).toEqual({ width: 480, height: 320 })
  })
})

describe("planFrames", () => {
  it("fits the file's frame to its largest story and gives much smaller ones their own", () => {
    const [plan] = planFrames([
      { exportName: "Playground", file: "button.stories.tsx", frame: { width: 200, height: 120 } },
      { exportName: "Variants", file: "button.stories.tsx", frame: { width: 880, height: 120 } },
      { exportName: "Loading", file: "button.stories.tsx", frame: { width: 800, height: 120 } },
    ])
    expect(plan.meta).toEqual({ width: 880, height: 120 })
    expect(plan.stories).toEqual([{ exportName: "Playground", frame: { width: 200, height: 120 } }])
  })
})

describe("writeFrames", () => {
  const plan = { file: "x.stories.tsx", meta: { width: 880, height: 120 }, stories: [{ exportName: "Playground", frame: { width: 200, height: 120 } }] }

  it("adds the meta's frame last and a story's own frame", () => {
    const source = `export default {
  title: 'Kit/Button',
  component: Button,
  args: { children: 'Button' }
} satisfies Meta<typeof Button>

export const Playground: Story = {}

export const Variants: Story = {
  render: () => <p>Don't {"}"} break</p>,
}
`
    const { source: out, skipped } = writeFrames(source, plan)
    expect(skipped).toEqual([])
    expect(out).toContain(`  args: { children: 'Button' },\n  parameters: { viewport: { width: 880, height: 120 } },\n} satisfies`)
    expect(out).toContain(`export const Playground: Story = { parameters: { viewport: { width: 200, height: 120 } } }`)
    expect(out).toContain(`render: () => <p>Don't {"}"} break</p>,\n}`)
  })

  it("goes into existing parameters, and leaves a frame that is already set", () => {
    const source = `const meta = { title: "Kit/Chip", parameters: { layout: "centered" } }
export default meta
export const Playground = { parameters: { viewport: { width: 300 } } }
`
    const { source: out, skipped } = writeFrames(source, plan)
    expect(out).toContain(`parameters: { viewport: { width: 880, height: 120 }, layout: "centered" }`)
    expect(out).toContain(`export const Playground = { parameters: { viewport: { width: 300 } } }`)
    expect(skipped).toEqual(["Playground: already has a viewport"])
  })

  it("adds the frame last in a one-line object", () => {
    const source = `export default { title: "Brand/Logo", component: Logo } satisfies Meta<typeof Logo>\nexport const Playground = { args: { size: 2 } }\n`
    expect(writeFrames(source, plan).source).toBe(
      `export default { title: "Brand/Logo", component: Logo, parameters: { viewport: { width: 880, height: 120 } } } satisfies Meta<typeof Logo>\nexport const Playground = { args: { size: 2 }, parameters: { viewport: { width: 200, height: 120 } } }\n`,
    )
  })
})
