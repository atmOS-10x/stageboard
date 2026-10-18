export function BrandMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="brand-bg" x1="0" y1="0" x2="256" y2="256" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1c1b24" />
          <stop offset="1" stopColor="#0f0f14" />
        </linearGradient>
        <linearGradient id="brand-tile" x1="138" y1="138" x2="202" y2="202" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a99cff" />
          <stop offset="1" stopColor="#6f8dff" />
        </linearGradient>
      </defs>
      <rect width="256" height="256" rx="58" fill="url(#brand-bg)" />
      <rect x="0.75" y="0.75" width="254.5" height="254.5" rx="57.25" stroke="#fff" strokeOpacity="0.08" strokeWidth="1.5" />
      <rect x="54" y="54" width="64" height="64" rx="16" stroke="#ececf1" strokeWidth="9" />
      <rect x="138" y="54" width="64" height="64" rx="16" stroke="#ececf1" strokeOpacity="0.45" strokeWidth="9" />
      <rect x="54" y="138" width="64" height="64" rx="16" stroke="#ececf1" strokeOpacity="0.45" strokeWidth="9" />
      <rect x="133.5" y="133.5" width="73" height="73" rx="36.5" fill="url(#brand-tile)" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-fg">
      <BrandMark />
      stageboard
    </span>
  )
}
