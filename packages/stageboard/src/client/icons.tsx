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

export function PointerIcon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M3.5 2.5l9 4.2-3.9 1.1-1.6 3.7z" />
    </Icon>
  )
}

export function PenIcon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M10.5 2.8l2.7 2.7-7.6 7.6-3.3.6.6-3.3z" />
      <path d="M9.2 4.1l2.7 2.7" />
    </Icon>
  )
}

export function SquareIcon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.6" />
    </Icon>
  )
}

export function ComponentIcon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M8 1.8l2.4 2.4L8 6.6 5.6 4.2zM8 9.4l2.4 2.4L8 14.2l-2.4-2.4zM4.2 5.6l2.4 2.4-2.4 2.4L1.8 8zM11.8 5.6L14.2 8l-2.4 2.4L9.4 8z" />
    </Icon>
  )
}

export function UndoIcon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M5.5 4L2.5 7l3 3" />
      <path d="M2.8 7h6.7a4 4 0 0 1 0 8H8" />
    </Icon>
  )
}

export function SketchIcon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M2.5 11.5c1.6-3 3.2-4.4 4.6-4.4 1.6 0 1 3.2 2.6 3.2 1.1 0 2-1.3 3.8-4.8" />
      <path d="M2.5 13.5h11" />
    </Icon>
  )
}
