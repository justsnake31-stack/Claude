# vendor

- `anthropic.bundle.js` — official Anthropic TypeScript/JavaScript SDK (`@anthropic-ai/sdk` 1.3.0, MIT), bundled for the browser:
  `esbuild entry.js --bundle --format=esm --minify --platform=browser` with `entry.js` = `export { default as Anthropic } from "@anthropic-ai/sdk";`.
  Used only by the "Точный анализ" button (photos are sent to the Claude API with the user's own API key).
