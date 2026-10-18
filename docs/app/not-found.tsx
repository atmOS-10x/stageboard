import Link from "next/link"

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-fd-muted-foreground">This page doesn&apos;t exist, or it moved.</p>
      <Link href="/" className="text-fd-primary underline underline-offset-4">
        Back to the docs
      </Link>
    </main>
  )
}
