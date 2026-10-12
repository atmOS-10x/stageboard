import type { ReactNode, SVGProps } from "react"

function Icon({ children, size = 14, ...rest }: SVGProps<SVGSVGElement> & { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function AnnotateIcon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M6 2.5H4A1.5 1.5 0 0 0 2.5 4v2M10 2.5h2A1.5 1.5 0 0 1 13.5 4v1M2.5 10v2A1.5 1.5 0 0 0 4 13.5h2" />
      <path d="M8.5 8.5l5 1.8-2.1.9-.9 2.1z" />
    </Icon>
  )
}

export function InspectIcon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M3 3l4 10 1.5-4.5L13 7z" />
    </Icon>
  )
}

export function PlusIcon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M8 3.5v9M3.5 8h9" />
    </Icon>
  )
}

export function ArrowUpIcon(props: { size?: number }) {
  return (
    <Icon {...props} strokeWidth={1.7}>
      <path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7" />
    </Icon>
  )
}

export function CloseIcon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </Icon>
  )
}

export function CheckIcon(props: { size?: number }) {
  return (
    <Icon {...props} strokeWidth={1.6}>
      <path d="M3.5 8.5l3 3 6-7" />
    </Icon>
  )
}

export function AlertIcon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5.2v3.3M8 10.8v.01" />
    </Icon>
  )
}

export function LayersIcon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="2.5" width="7" height="5" rx="1.2" />
      <rect x="6.5" y="8.5" width="7" height="5" rx="1.2" />
    </Icon>
  )
}

export function SparkIcon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M8 2.5c.4 2.6 1.9 4.1 4.5 4.5-2.6.4-4.1 1.9-4.5 4.5-.4-2.6-1.9-4.1-4.5-4.5 2.6-.4 4.1-1.9 4.5-4.5z" />
    </Icon>
  )
}

export function ImageIcon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="3" width="11" height="10" rx="1.6" />
      <circle cx="6" cy="6.5" r="1" />
      <path d="M13.5 10.5 10.5 8l-6 5" />
    </Icon>
  )
}
