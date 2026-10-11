import { lazy, Suspense, type ComponentType, type ReactNode } from "react"

type Loader<P> = () => Promise<ComponentType<P> | { default: ComponentType<P> }>
type Options = { loading?: () => ReactNode; ssr?: boolean }

export default function dynamic<P extends object>(loader: Loader<P>, options: Options = {}): ComponentType<P> {
  const Lazy = lazy(async () => {
    const mod = await loader()
    return "default" in mod ? (mod as { default: ComponentType<P> }) : { default: mod as ComponentType<P> }
  })
  return function Dynamic(props: P) {
    return (
      <Suspense fallback={options.loading ? options.loading() : null}>
        <Lazy {...(props as any)} />
      </Suspense>
    )
  }
}
