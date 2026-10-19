import { describe, expect, it } from "vitest"
import { validateReferences } from "./protocol"

describe("validateReferences", () => {
  it("keeps URLs and project paths, trims the image and drops empty fields", () => {
    expect(validateReferences([{ references: [{ image: " https://x.test/a.png ", app: "Linear", caption: "" }, { image: "refs/b.png" }] }])).toEqual([
      { references: [{ image: "https://x.test/a.png", app: "Linear" }, { image: "refs/b.png" }] },
    ])
  })

  it("rejects paths outside the project and links that are not http", () => {
    expect(() => validateReferences([{ references: [{ image: "../secret.png" }] }])).toThrow("steps[0].references[0]")
    expect(() => validateReferences([{ references: [{ image: "/etc/passwd" }] }])).toThrow("inside the project")
    expect(() => validateReferences([{ references: [{ image: "a.png", url: "javascript:alert(1)" }] }])).toThrow("http(s)")
  })
})
