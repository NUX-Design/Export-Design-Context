# Export Design Context

A read-only Figma plugin that turns selected nodes into an implementation-ready design context for coding agents.

## Features

- Scans selected nodes and optionally includes descendants, including hidden layers.
- Exports a Markdown brief with node hierarchy, geometry, layout, component metadata, text, variables, styles, and raw property values.
- Exports a structured JSON snapshot with variable bindings, modes, aliases, dependencies, and captured component metadata.
- Exports a PNG visual reference when a single root node is selected. Keep it beside the Markdown file.
- Reports unavailable metadata and scan limits instead of guessing values.

## Build and install

Requires Node.js and npm.

```sh
npm install
npm run build
```

In Figma Desktop, choose **Plugins → Development → Import plugin from manifest…** and select `manifest.json`. Run `npm run build` after changing `code.ts`; `code.js` is the generated entry point referenced by the manifest.

## Exports and limits

Markdown and JSON are available after each successful scan. The PNG reference is available for one selected root at a time. The export includes the selected subtree and referenced definitions, not the full Figma library. It does not include source image binaries, vector path data, or animation timelines. Prototype reactions are included when the Figma API exposes them; they do not describe all runtime behavior.

Review exported text content before sharing reports with AI services.
