import { defineConfig } from "vite"
import { cpSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"

// O build de áudio é independente do Importmap. Binários pré-compilados ficam no mesmo host.
export default defineConfig({
  publicDir: false,
  base: "/audio-engine/",
  build: {
    outDir: "public/audio-engine", emptyOutDir: true,
    lib: { entry: "app/audio_engine/harmony_engine.js", formats: ["es"], fileName: () => "engine.js" },
    rollupOptions: { output: { assetFileNames: "assets/[name]-[hash][extname]" } }
  },
  plugins: [{
    name: "local-opendaw-wasm",
    /** Copia artefatos publicados; não baixa recursos nem compila Rust durante execução. */
    writeBundle() {
      const target = resolve("public/audio-engine/wasm")
      mkdirSync(target, { recursive: true })
      cpSync(resolve("node_modules/@opendaw/studio-core-wasm/dist/wasm"), target, { recursive: true })
    }
  }]
})
