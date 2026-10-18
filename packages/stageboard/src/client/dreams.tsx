const REVEALS = "stageboard:dream-reveals"

export function pendingReveals(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(REVEALS) ?? "[]")
  } catch {
    return []
  }
}

export function markReveal(id: string, on: boolean) {
  const list = pendingReveals().filter((x) => x !== id)
  sessionStorage.setItem(REVEALS, JSON.stringify(on ? [...list, id] : list))
}
