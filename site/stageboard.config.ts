import tailwind from "@tailwindcss/vite"
import { defineConfig } from "stageboard"

// Same agent setup as atmos-health: each note starts an atmOS Agent Session on this Machine, in this worktree, on
// Claude Code with Opus 5.5 and the Claude subscription with the most left (stageboard/atmos-session.mjs resolves
// it). The command runs from the repository root. The bridge is on :6080, since atmos-health's takes :6070.
export default defineConfig({
  stories: ["src/**/*.stories.tsx"],
  preview: "./src/preview.tsx",
  port: 6080,
  vite: { plugins: [tailwind()] },
  agent: { provider: "command", command: "node site/stageboard/atmos-session.mjs {promptFile}" },
  instructions:
    "This is the stageboard landing page in site/: React, Tailwind v4 with the tokens in site/src/styles.css, in stageboard's own dark style. Check changes with npx stageboard shot from site/ at 1440 and 390 px.",
})
