import { describe, expect, it } from "vitest"
import type { ChangeRequest, Job } from "../core/protocol"
import type { ResolvedConfig } from "./config"
import { buildPrompt } from "./prompt"

const config = { root: "/app", stories: [] } as unknown as ResolvedConfig
const job = { id: "j1", images: [{ label: "1:selection", path: "/tmp/sel.png" }] } as unknown as Job

describe("buildPrompt for a note on a component", () => {
  const request: ChangeRequest = {
    kind: "edit",
    note: "Make the focus ring match the inputs",
    component: {
      title: "Primitives/Button",
      stories: [
        { id: "primitives-button--primary", name: "Primary" },
        { id: "primitives-button--disabled", name: "Disabled" },
      ],
    },
    annotations: [{ storyId: "primitives-button--disabled", title: "Disabled", step: 1, note: "Too faint", region: { x: 10, y: 10, width: 80, height: 40 }, viewport: { width: 200, height: 120 } }],
    target: { url: "", title: "Primitives/Button", selector: "", tag: "component", rect: { x: 0, y: 0, width: 0, height: 0 }, viewport: { width: 0, height: 0 }, components: [], storyId: "primitives-button--primary" },
  }
  const prompt = buildPrompt(config, job, request, [{ id: "primitives-button--primary", title: "Primitives/Button / Primary", file: "src/button.stories.tsx" }])

  it("asks to change the component across all its stories, listing them", () => {
    expect(prompt).toContain(`Change the component "Primitives/Button"`)
    expect(prompt).toContain("## Its stories (in src/button.stories.tsx)")
    expect(prompt).toContain("2. `primitives-button--disabled` — Disabled")
    expect(prompt).toContain("What the user asked for: Make the focus ring match the inputs")
  })

  it("lists the batch story by story, not as a flow", () => {
    expect(prompt).toContain("## The user's annotations, story by story")
    expect(prompt).toContain("### 1. Story 2: Disabled")
    expect(prompt).toContain("About the area at x=10, y=10, 80×40 in a 200×120 viewport.")
    expect(prompt).not.toContain("went through the flow")
  })
})
