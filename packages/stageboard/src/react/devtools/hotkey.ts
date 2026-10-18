// Shortcuts written as "alt+shift+c" or "mod+shift+i"; `mod` is Cmd on a Mac and Ctrl elsewhere.
export type Hotkey = { alt: boolean; shift: boolean; ctrl: boolean; meta: boolean; key: string }

export const DEFAULT_HOTKEY = "alt+shift+c"

const MODS: Record<string, "alt" | "shift" | "ctrl" | "meta" | "mod"> = {
  alt: "alt",
  option: "alt",
  opt: "alt",
  shift: "shift",
  ctrl: "ctrl",
  control: "ctrl",
  meta: "meta",
  cmd: "meta",
  command: "meta",
  mod: "mod",
}
const KEYS: Record<string, string> = { esc: "escape", space: " ", plus: "+", return: "enter" }

function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
}

export function parseHotkey(spec: string, mac = isMac()): Hotkey | undefined {
  const parts = spec.toLowerCase().replace(/\s+/g, "").split(/\+(?!$)/)
  const out: Hotkey = { alt: false, shift: false, ctrl: false, meta: false, key: "" }
  for (const part of parts) {
    const mod = MODS[part]
    if (mod === "mod") out[mac ? "meta" : "ctrl"] = true
    else if (mod) out[mod] = true
    else if (out.key || !part) return undefined
    else out.key = KEYS[part] ?? part
  }
  return out.key ? out : undefined
}

// Letters and digits are matched by physical key, because Alt (Option on a Mac) changes the character typed.
export function matchesHotkey(e: KeyboardEvent, hk: Hotkey): boolean {
  if (e.altKey !== hk.alt || e.shiftKey !== hk.shift || e.ctrlKey !== hk.ctrl || e.metaKey !== hk.meta) return false
  if (/^[a-z]$/.test(hk.key)) return e.code === `Key${hk.key.toUpperCase()}`
  if (/^[0-9]$/.test(hk.key)) return e.code === `Digit${hk.key}`
  return e.key.toLowerCase() === hk.key
}

export function hotkeyLabel(hk: Hotkey, mac = isMac()): string {
  const names = [hk.ctrl && "Ctrl", hk.alt && "Alt", hk.shift && "Shift", hk.meta && (mac ? "Cmd" : "Meta")].filter(Boolean)
  const key = hk.key === " " ? "Space" : hk.key.length === 1 ? hk.key.toUpperCase() : hk.key[0].toUpperCase() + hk.key.slice(1)
  return [...names, key].join("+")
}
