import { defineConfig } from "fumadocs-mdx/config"

// Global MDX options. The docs collection itself is declared in lib/source.ts (fumadocs-mdx macro).
export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: { light: "github-light-default", dark: "github-dark-default" },
    },
    // ```npm blocks become npm / pnpm / yarn / bun tabs; the choice is remembered across pages.
    remarkNpmOptions: { persist: { id: "package-manager" } },
  },
})
