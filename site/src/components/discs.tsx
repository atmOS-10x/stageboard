import { useId } from "react"

// Filled circles with the mark cut out of them, so the page shows through: a check for yes, a cross for no.

export function CheckDisc({ className = "size-5" }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 20 20" className={`shrink-0 ${className}`} aria-hidden="true">
      <mask id={id}>
        <rect width="20" height="20" fill="#fff" />
        <path d="M5.8 10.4l2.8 2.8 5.6-6" fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </mask>
      <circle cx="10" cy="10" r="10" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  )
}

export function CrossDisc({ className = "size-5" }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 20 20" className={`shrink-0 ${className}`} aria-hidden="true">
      <mask id={id}>
        <rect width="20" height="20" fill="#fff" />
        <path d="M7 7l6 6M13 7l-6 6" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" />
      </mask>
      <circle cx="10" cy="10" r="10" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  )
}
