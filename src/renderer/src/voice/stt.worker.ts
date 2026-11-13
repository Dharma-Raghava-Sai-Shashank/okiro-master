// Speech-to-text: Moonshine or Whisper (English) on-device via transformers.js, WebGPU first, WASM fallback.
// Moonshine is the default: built for short utterances (no 30 s padding), faster and slightly more accurate.
import { env, pipeline } from '@huggingface/transformers'
import { hasWebGpu, type WorkerScope } from './worker-types'

type Asr = (audio: Float32Array, opts?: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>

const ctx = self as unknown as WorkerScope
let asr: Asr | null = null
let model = ''

ctx.onmessage = async ({ data }: MessageEvent) => {
  try {
    if (data.type === 'load') {
      if (asr && model === data.model) return ctx.postMessage({ type: 'ready' })
      model = data.model
      env.allowLocalModels = false
      env.useBrowserCache = true
      if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = data.ortBase
      const webgpu = await hasWebGpu()
      const make = async () =>
        (await pipeline('automatic-speech-recognition', model, {
          device: webgpu ? 'webgpu' : 'wasm',
          dtype: webgpu ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : { encoder_model: 'q8', decoder_model_merged: 'q8' },
          progress_callback: (p: unknown) => ctx.postMessage({ type: 'progress', p })
        })) as unknown as Asr
      try {
        asr = await make()
      } catch (e) {
        // An interrupted download leaves truncated bytes in Cache Storage, and every later load
        // replays them ("protobuf parsing failed"). Clear the cache and fetch fresh, once.
        if (!/protobuf|corrupt|invalid/i.test(String(e))) throw e
        await caches.delete('transformers-cache')
        asr = await make()
      }
      // Warm-up compiles the GPU shaders so the first real utterance is fast.
      await asr(new Float32Array(16_000))
      ctx.postMessage({ type: 'ready', device: webgpu ? 'webgpu' : 'wasm' })
    } else if (data.type === 'transcribe') {
      if (!asr) throw new Error('Speech recognition is not loaded')
      // English-only models (moonshine, whisper .en) must not get language/task options.
      const audio = data.audio as Float32Array
      const opts: Record<string, unknown> = { max_new_tokens: data.long ? 256 : 128 }
      if (data.long && model.includes('whisper') && audio.length > 28 * 16_000) {
        // A full buffered utterance can exceed Whisper's 30s window: decode in strided chunks.
        opts.chunk_length_s = 28
        opts.stride_length_s = 2
      }
      const out = await asr(audio, opts)
      const text = (Array.isArray(out) ? out[0] : out).text.trim()
      ctx.postMessage({ type: 'result', id: data.id, text })
    }
  } catch (e) {
    ctx.postMessage({ type: 'error', id: data.id, message: e instanceof Error ? e.message : String(e) })
  }
}
