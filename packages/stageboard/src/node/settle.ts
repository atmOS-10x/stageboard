import type { Page } from "playwright-core"

const MAX_MS = 3000
const QUIET_MS = 250

// Waits until finite CSS/Web animations have finished and the DOM has stopped changing, so counters and
// charts are captured at their final values. Infinite animations (spinners) are ignored; capped at MAX_MS.
export async function settle(page: Page): Promise<void> {
  await page
    .evaluate(
      async ({ max, quiet }) => {
        const deadline = performance.now() + max
        const left = () => Math.max(0, deadline - performance.now())
        const finite = document.getAnimations().filter((a) => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime)))
        await Promise.race([Promise.all(finite.map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, left()))])
        await new Promise<void>((resolve) => {
          let timer = setTimeout(done, quiet)
          const cap = setTimeout(done, left())
          const observer = new MutationObserver(() => {
            clearTimeout(timer)
            timer = setTimeout(done, quiet)
          })
          observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
          function done() {
            observer.disconnect()
            clearTimeout(timer)
            clearTimeout(cap)
            resolve()
          }
        })
      },
      { max: MAX_MS, quiet: QUIET_MS },
    )
    .catch(() => {})
}
