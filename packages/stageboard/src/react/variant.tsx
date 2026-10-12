import { createElement, type ComponentType, type ReactNode } from "react"
import { useSelectedVariant } from "./store"

export const VARIANT_MARKER = "__stageboardVariant"

function isProduction(): boolean {
  try {
    return process.env.NODE_ENV === "production"
  } catch {
    return false
  }
}

export function StageboardVariant({ id, children }: { id: string; active: string; children?: ReactNode }) {
  const used = ((globalThis as Record<string, unknown>).__STAGEBOARD_USED__ ??= new Set<string>()) as Set<string>
  used.add(id)
  return children
}
;(StageboardVariant as unknown as Record<string, unknown>)[VARIANT_MARKER] = true

export type VariantProps = {
  id: string
  children?: ReactNode
  props?: Record<string, unknown>
}

export function Variant({ id, children, props }: VariantProps) {
  const selected = useSelectedVariant(id)
  if (isProduction()) return <>{children}</>
  return (
    <StageboardVariant id={id} active={selected?.key ?? "original"}>
      {selected ? createElement(selected.component, props ?? {}) : children}
    </StageboardVariant>
  )
}

export function variant<P extends object>(id: string, Original: ComponentType<P>): ComponentType<P> {
  if (isProduction()) return Original
  function Variantable(props: P) {
    const selected = useSelectedVariant(id)
    const Component = (selected?.component ?? Original) as ComponentType<P>
    return (
      <StageboardVariant id={id} active={selected?.key ?? "original"}>
        <Component {...props} />
      </StageboardVariant>
    )
  }
  Variantable.displayName = Original.displayName || Original.name || "Variantable"
  return Variantable
}
