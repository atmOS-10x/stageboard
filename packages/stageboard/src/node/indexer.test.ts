import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import type { ResolvedConfig } from "./config"
import { indexFile } from "./indexer"

const root = fs.mkdtempSync(path.join(os.tmpdir(), "stageboard-indexer-"))
const config = { root, stories: ["**/*.stories.tsx"] } as unknown as ResolvedConfig

function index(name: string, source: string) {
  const file = path.join(root, name)
  fs.writeFileSync(file, source)
  return indexFile(config, file)
}

function pages(stories: ReturnType<typeof index>) {
  return Object.fromEntries(stories.map((s) => [s.exportName, s.hasPage]))
}

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe("indexFile", () => {
  it("decides page-ness per story in a file mixing routed and unrouted stories", () => {
    const stories = index(
      "settings.stories.tsx",
      `import type { Meta, Story } from "stageboard"
export default { title: "Settings", parameters: { layout: "fullscreen" } } satisfies Meta

export const Profile: Story = { render: () => <Settings tab="profile" />, parameters: { page: { route: "/settings", title: "Settings" } } }
export const Billing: Story = { name: "Billing tab", render: () => <Settings tab="billing" /> }
export const Empty: Story = { ...Profile, args: { items: [] } }
export const Invite: Story = { render: () => <Invite />, parameters: { ...Profile.parameters, layout: "padded" } }
export const Saving: Story = { args: { page: 2 }, render: () => <p>Don't leave yet</p> }
`,
    )
    expect(pages(stories)).toEqual({ Profile: true, Billing: false, Empty: true, Invite: true, Saving: false })
    expect(stories.every((s) => s.title === "Settings")).toBe(true)
    expect(stories.find((s) => s.exportName === "Billing")?.name).toBe("Billing tab")
  })

  it("marks every story a screen when the meta sets page.route", () => {
    const stories = index(
      "home.stories.tsx",
      `export default { title: "Home", parameters: { page: { route: "/" } } }
export const Default = {}
export const Loading = { args: { loading: true } }
`,
    )
    expect(pages(stories)).toEqual({ Default: true, Loading: true })
  })

  it("reads the title from const meta with export default meta", () => {
    const stories = index(
      "pages.stories.tsx",
      `import type { Meta, Story } from "stageboard"
const meta = {
  component: Page,
  parameters: { layout: "fullscreen" },
  title: "App/Pages",
} satisfies Meta<typeof Page>

export const Home: Story = { parameters: { page: { route: "/", title: "Home page" } } }
export const Card: Story = { render: () => <Card title="Not the title" /> }

export default meta
`,
    )
    expect(stories.map((s) => s.title)).toEqual(["App/Pages", "App/Pages"])
    expect(stories.map((s) => s.id)).toEqual(["app-pages--home", "app-pages--card"])
    expect(pages(stories)).toEqual({ Home: true, Card: false })
  })

  it("handles a typed meta and export default meta satisfies Meta", () => {
    const stories = index(
      "typed.stories.tsx",
      `const meta: Meta<typeof Button> = { title: "Kit/Button", parameters: { page: undefined } }
export default meta satisfies Meta
export const Primary: Story = { parameters: { page: { title: "Nope" } } }
`,
    )
    expect(stories[0].title).toBe("Kit/Button")
    expect(stories[0].hasPage).toBe(false)
  })

  it("ignores nested titles and falls back to the path", () => {
    const stories = index(
      "nested-title.stories.tsx",
      `export default { parameters: { page: { route: "/x", title: "Page title" } } }
export const One = {}
`,
    )
    expect(stories[0].title).toBe("Nested Title")
    expect(stories[0].hasPage).toBe(true)
  })

  it("reads a component's frame from its own or its meta's parameters.viewport", () => {
    const stories = index(
      "frames.stories.tsx",
      `export default { title: "Kit/Chip", parameters: { layout: "centered", viewport: { width: 320, height: 180 } } }
export const Default = {}
export const Wide: Story = { args: { long: true }, parameters: { viewport: { width: 960 } } }
export const Nested = { render: () => <Chip style={{ width: 20 }} />, args: { viewport: { width: 1 } } }
`,
    )
    expect(Object.fromEntries(stories.map((s) => [s.exportName, s.viewport]))).toEqual({
      Default: { width: 320, height: 180 },
      Wide: { width: 960 },
      Nested: { width: 320, height: 180 },
    })
  })

  it("reads the layout, so a fullscreen story gets a page-sized frame", () => {
    const stories = index(
      "layouts.stories.tsx",
      `export default { title: "Pages/Calendar" } satisfies Meta
export const Day = { ...day, parameters: { layout: "fullscreen" } } satisfies Story
export const Legend = { render: () => <Legend layout="padded" /> }
`,
    )
    expect(Object.fromEntries(stories.map((s) => [s.exportName, s.layout]))).toEqual({ Day: "fullscreen", Legend: undefined })
  })
})
