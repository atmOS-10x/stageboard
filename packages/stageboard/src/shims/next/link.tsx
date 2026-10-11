import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react"

type Href = string | { pathname?: string; query?: Record<string, string>; hash?: string }
type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: Href
  prefetch?: boolean | null
  replace?: boolean
  scroll?: boolean
  shallow?: boolean
  legacyBehavior?: boolean
  passHref?: boolean
  children?: ReactNode
}

function toHref(href: Href): string {
  if (typeof href === "string") return href
  const query = href.query ? `?${new URLSearchParams(href.query)}` : ""
  return `${href.pathname ?? ""}${query}${href.hash ? `#${href.hash}` : ""}`
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch: _p, replace: _r, scroll: _s, shallow: _sh, legacyBehavior: _l, passHref: _ph, onClick, ...rest },
  ref,
) {
  const target = toHref(href)
  return (
    <a
      ref={ref}
      href={target}
      data-stageboard-link={target}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        e.preventDefault()
        window.parent?.postMessage({ source: "stageboard", type: "navigate", href: target }, "*")
      }}
      {...rest}
    />
  )
})

export default Link
