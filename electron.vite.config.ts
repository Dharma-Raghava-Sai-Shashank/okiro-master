import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = { '@shared': resolve('src/shared') }

// Strict CSP for the packaged renderer (dev needs inline scripts for React refresh).
// 'wasm-unsafe-eval' is for the on-device speech models (onnxruntime-web); the Hugging Face hosts
// serve the model weights, downloaded once and kept in the browser cache.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co",
  "media-src 'self' blob:"
].join('; ')

const csp = {
  name: 'okiro-csp',
  apply: 'build' as const,
  transformIndexHtml: (html: string) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
}

/**
 * Copies the onnxruntime-web WASM runtime and the Silero VAD worklet/model into the renderer's
 * public folder, so the voice stack never loads code from a CDN at runtime.
 */
const voiceAssets = {
  name: 'okiro-voice-assets',
  buildStart() {
    const pub = resolve('src/renderer/public')
    const ort = resolve('node_modules/onnxruntime-web/dist')
    const vad = resolve('node_modules/@ricky0123/vad-web/dist')
    const copy = (from: string, files: string[], to: string) => {
      mkdirSync(to, { recursive: true })
      for (const f of files) if (existsSync(`${from}/${f}`)) cpSync(`${from}/${f}`, `${to}/${f}`)
    }
    // transformers.js (Whisper) and kokoro-js use the JSEP (WebGPU-capable) build.
    copy(ort, ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm'], `${pub}/ort`)
    // vad-web uses the plain build.
    copy(ort, ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'], `${pub}/vad`)
    copy(vad, ['vad.worklet.bundle.min.js', 'silero_vad_v5.onnx', 'silero_vad_v6.onnx'], `${pub}/vad`)
  }
}

export default defineConfig({
  main: {
    resolve: { alias: shared },
    build: { rollupOptions: { external: ['node:sqlite'] } }
  },
  preload: {
    resolve: { alias: shared }
  },
  renderer: {
    resolve: {
      alias: {
        ...shared,
        '@renderer': resolve('src/renderer/src'),
        '@ricky0123/vad-web': resolve('node_modules/@ricky0123/vad-web/dist/bundle.min.js')
      }
    },
    plugins: [voiceAssets, react(), tailwindcss(), csp],
    // transformers.js uses dynamic imports inside workers, which need ES-module workers.
    worker: { format: 'es' },
    optimizeDeps: { exclude: ['@huggingface/transformers', 'kokoro-js', 'onnxruntime-web'] }
  }
})
