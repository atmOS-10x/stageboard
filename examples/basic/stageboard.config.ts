import tailwind from "@tailwindcss/vite"
import { defineConfig } from "stageboard"

export default defineConfig({
  stories: ["src/**/*.stories.tsx"],
  preview: "./src/preview.tsx",
  vite: { plugins: [tailwind()] },
  agent: { provider: "claude" },
})
