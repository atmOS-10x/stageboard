import { describe, expect, it } from "vitest"
import { fillRoute, findScreen, matchRoute } from "./routes"

const screen = (route: string) => ({ page: { route } })

describe("routes", () => {
  it("matches dynamic segments", () => {
    expect(matchRoute("/stays/[id]", "/stays/42?tab=photos")).toEqual({ id: "42" })
    expect(matchRoute("/stays/:id", "/stays/42/")).toEqual({ id: "42" })
    expect(matchRoute("/docs/[...slug]", "/docs/a/b")).toEqual({ slug: ["a", "b"] })
    expect(matchRoute("/docs/[...slug]", "/docs")).toBeUndefined()
    expect(matchRoute("/[[...slug]]", "/")).toEqual({})
    expect(matchRoute("/(shop)/cart", "/cart")).toEqual({})
    expect(matchRoute("/stays/[id]", "/stays")).toBeUndefined()
  })

  it("prefers exact and more specific routes", () => {
    const screens = [screen("/stays/[id]"), screen("/stays/new"), screen("/[team]/tickets/[id]")]
    expect(findScreen(screens, "/stays/new")).toBe(screens[1])
    expect(findScreen(screens, "/stays/7")).toBe(screens[0])
    expect(findScreen(screens, "/[team]/tickets/[id]")).toBe(screens[2])
    expect(findScreen(screens, "/acme/tickets/9")).toBe(screens[2])
    expect(findScreen(screens, "/nowhere")).toBeUndefined()
  })

  it("fills a route with params", () => {
    expect(fillRoute("/stays/[id]", { id: "42" })).toBe("/stays/42")
    expect(fillRoute("/docs/[...slug]", { slug: ["a", "b"] })).toBe("/docs/a/b")
    expect(fillRoute("/stays/[id]", {})).toBe("/stays/[id]")
  })
})
