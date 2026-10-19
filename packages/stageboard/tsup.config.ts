import { defineConfig } from "tsup"

const external = ["react", "react-dom", "react/jsx-runtime", "vite", "stageboard", /^stageboard\//, /^virtual:/, /^next\//]

export default defineConfig([
  {
    entry: {
      "core/index": "src/core/index.ts",
      "react/index": "src/react/index.ts",
      "client/index": "src/client/index.tsx",
    },
    format: "esm",
    dts: true,
    platform: "browser",
    target: "es2022",
    external,
    clean: true,
    splitting: true,
    banner: { js: "" },
  },
  {
    entry: {
      "node/index": "src/node/index.ts",
      "node/cli": "src/node/cli.ts",
      "node/next": "src/node/next.ts",
    },
    format: "esm",
    dts: { entry: { "node/index": "src/node/index.ts", "node/next": "src/node/next.ts" } },
    platform: "node",
    target: "node20",
    external,
    splitting: true,
  },
  {
    entry: { "embed/flow": "src/embed/flow.tsx" },
    format: "iife",
    globalName: "StageboardFlowEmbed",
    platform: "browser",
    target: "es2020",
    noExternal: [/.*/],
    minify: true,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
  },
  {
    entry: {
      "shims/next/image": "src/shims/next/image.tsx",
      "shims/next/link": "src/shims/next/link.tsx",
      "shims/next/navigation": "src/shims/next/navigation.ts",
      "shims/next/font": "src/shims/next/font.ts",
      "shims/next/dynamic": "src/shims/next/dynamic.tsx",
      "shims/next/script": "src/shims/next/script.tsx",
      "shims/next/head": "src/shims/next/head.tsx",
    },
    format: "esm",
    platform: "browser",
    target: "es2022",
    external,
  },
])
