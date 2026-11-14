/// <reference types="vite/client" />

// JSON modules (crops.json and bundled sample payloads) are typed by Vite's client
// declarations plus `resolveJsonModule` in tsconfig.json. No extra ambient declaration
// is needed here; adding one would shadow Vite's own `*.json` module type.
