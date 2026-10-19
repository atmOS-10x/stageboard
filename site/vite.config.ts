import { resolve } from "node:path"
import tailwind from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwind()],
  // Lets `vite preview` answer on a Tailscale hostname for remote review.
  preview: { allowedHosts: [".ts.net"] },
  build: { rollupOptions: { input: { main: resolve(import.meta.dirname, "index.html"), imprint: resolve(import.meta.dirname, "imprint.html"), privacy: resolve(import.meta.dirname, "privacy.html") } } },
})
