import type { ReactNode } from "react"

// Text with a light band sweeping across it, as assistant-ui's shimmer (tw-shimmer) does.
export function Shimmer({ children }: { children: ReactNode }) {
  return <span className="sbu-shimmer">{children}</span>
}
