import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react"

type Variant = "solid" | "soft" | "ghost" | "link"
type Size = "sm" | "md" | "lg"

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  on?: boolean
  count?: number
}

// stageboard's one button: a pill. Solid for the main action (and a toggle that is on), soft by default,
// ghost for quiet actions, link for inline text actions.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "soft", size = "md", icon, on, count, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`sbu-b${className ? ` ${className}` : ""}`}
      data-variant={variant}
      data-size={size}
      data-on={on || undefined}
      data-has-icon={icon && children ? "true" : undefined}
      aria-pressed={on === undefined ? undefined : on}
      {...rest}
    >
      {icon}
      {icon && children ? <span className="sbu-b-text">{children}</span> : children}
      {count !== undefined && count > 0 && <span className="sbu-b-count">{count}</span>}
    </button>
  )
})

export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, "children" | "count"> & { label: string }>(function IconButton(
  { label, icon, title, ...rest },
  ref,
) {
  return <Button ref={ref} icon={icon} aria-label={label} title={title ?? label} data-icon="true" {...rest} />
})

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: {
  className?: string
  options: { value: T; label: ReactNode; title?: string }[]
  value: T
  onChange: (value: T) => void
  label: string
  size?: "sm" | "md"
}) {
  return (
    <div className={`sbu-seg${className ? ` ${className}` : ""}`} data-size={size} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} data-on={value === o.value} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { value: T; label: string }[]; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <nav className="sbu-nav" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.value} type="button" data-on={value === t.value} aria-current={value === t.value ? "page" : undefined} onClick={() => onChange(t.value)}>
          {t.label}
        </button>
      ))}
    </nav>
  )
}

// With an icon the input becomes an input group: the icon sits inside the field, and className goes on the group.
export const Input = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: "md" | "lg"; icon?: ReactNode }>(function Input(
  { size = "md", icon, className, ...rest },
  ref,
) {
  if (!icon) return <input ref={ref} className={`sbu-input${className ? ` ${className}` : ""}`} data-size={size} {...rest} />
  return (
    <div className={`sbu-input-group${className ? ` ${className}` : ""}`} data-size={size}>
      <span className="sbu-input-icon" aria-hidden="true">
        {icon}
      </span>
      <input ref={ref} className="sbu-input" data-size={size} {...rest} />
    </div>
  )
})
