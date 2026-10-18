import { describe, expect, it } from "vitest"
import { hotkeyLabel, matchesHotkey, parseHotkey } from "./hotkey"

const ev = (init: Partial<KeyboardEvent>) => ({ altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, key: "", code: "", ...init }) as KeyboardEvent

describe("hotkey", () => {
  it("parses and matches", () => {
    const hk = parseHotkey("alt+shift+c")!
    expect(matchesHotkey(ev({ altKey: true, shiftKey: true, key: "Ç", code: "KeyC" }), hk)).toBe(true)
    expect(matchesHotkey(ev({ altKey: true, key: "c", code: "KeyC" }), hk)).toBe(false)
    expect(hotkeyLabel(hk, false)).toBe("Alt+Shift+C")
  })

  it("maps mod to Cmd on a Mac and Ctrl elsewhere", () => {
    expect(parseHotkey("mod+shift+i", true)).toMatchObject({ meta: true, ctrl: false, shift: true, key: "i" })
    expect(parseHotkey("Mod + Shift + I", false)).toMatchObject({ meta: false, ctrl: true, key: "i" })
    expect(parseHotkey("ctrl++")).toMatchObject({ ctrl: true, key: "+" })
  })

  it("rejects specs without one key", () => {
    expect(parseHotkey("alt+shift")).toBeUndefined()
    expect(parseHotkey("a+b")).toBeUndefined()
  })
})
