import { describe, expect, it } from "vitest"
import { pickCss, scopeCss } from "./css"

describe("pickCss", () => {
  it("keeps matching rules in order, keyframes, and media queries with only their matching rules", () => {
    const css = `
html, body { margin: 0; }
.a-row { gap: 1px; }
.other { color: red; }
@keyframes spin { to { transform: rotate(1turn); } }
@media (max-width: 600px) { .other { color: blue; } .a-cell { flex: 1; } }
.a-row:hover, .x { opacity: 1; }
`
    expect(pickCss(css, /\.a-(row|cell)\b/)).toBe(
      [".a-row { gap: 1px; }", "@keyframes spin { to { transform: rotate(1turn); } }", "@media (max-width: 600px) {\n.a-cell { flex: 1; }\n}", ".a-row:hover, .x { opacity: 1; }"].join("\n"),
    )
  })
})

describe("scopeCss", () => {
  it("prefixes every selector, inside media queries too, and leaves keyframes alone", () => {
    expect(scopeCss(".a, .b:hover { x: 1; }\n@media (min-width: 1px) { .c { y: 2; } }\n@keyframes k { to { z: 3; } }", "#r")).toBe(
      "#r .a, #r .b:hover { x: 1; }\n@media (min-width: 1px) {\n#r .c { y: 2; }\n}\n@keyframes k { to { z: 3; } }",
    )
  })
})
