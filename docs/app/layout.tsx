import { RootProvider } from "fumadocs-ui/provider/next"
import type { Metadata, Viewport } from "next"
import { Consent } from "@/components/consent"
import { siteDescription, siteUrl } from "@/lib/shared"
import "./global.css"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "stageboard docs", template: "%s | stageboard" },
  description: siteDescription,
  icons: { icon: "/favicon.svg" },
  openGraph: { siteName: "stageboard", type: "website" },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0e11" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider theme={{ defaultTheme: "dark" }}>{children}</RootProvider>
        <Consent />
      </body>
    </html>
  )
}
