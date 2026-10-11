import { forwardRef, type CSSProperties, type ImgHTMLAttributes } from "react"

type StaticImport = { src: string; width?: number; height?: number; default?: StaticImport }
type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | StaticImport
  fill?: boolean
  priority?: boolean
  quality?: number
  placeholder?: string
  blurDataURL?: string
  unoptimized?: boolean
  loader?: unknown
}

const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  { src, fill, priority: _p, quality: _q, placeholder: _ph, blurDataURL: _b, unoptimized: _u, loader: _l, style, width, height, ...rest },
  ref,
) {
  const resolved = typeof src === "string" ? src : (src.default ?? src)
  const url = typeof resolved === "string" ? resolved : resolved.src
  const w = width ?? (typeof resolved === "object" ? resolved.width : undefined)
  const h = height ?? (typeof resolved === "object" ? resolved.height : undefined)
  const fillStyle: CSSProperties = fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : {}
  return <img ref={ref} src={url} width={fill ? undefined : w} height={fill ? undefined : h} style={{ ...fillStyle, ...style }} {...rest} />
})

export default Image
export function getImageProps(props: ImageProps) {
  return { props }
}
