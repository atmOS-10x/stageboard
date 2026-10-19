import { describe, expect, it } from "vitest"
import { embedCss } from "./styles"

describe("embedCss", () => {
  it("scopes every rule to the embed root and leaves out the board's page rules", () => {
    const css = embedCss("sb-flow-x")
    const selectors = css
      .split("\n")
      .filter((line) => line.includes("{") && !line.startsWith("@") && !/^\s*(from|to|\d+%)/.test(line))
      .map((line) => line.slice(0, line.indexOf("{")))
    expect(selectors.length).toBeGreaterThan(50)
    for (const selector of selectors) for (const part of selector.split(",")) expect(part.trim()).toMatch(/^#sb-flow-x /)
    expect(css).toContain(".sbu-flow-row")
    expect(css).toContain(".sbu-viewer-slot")
    const viewerRules = css.split("\n").filter((line) => line.startsWith("#sb-flow-x .sbu-viewer {"))
    expect(viewerRules.at(-1)).toContain("position: relative")
  })
})
