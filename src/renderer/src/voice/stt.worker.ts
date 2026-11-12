// Speech-to-text: Whisper (English) running on-device via transformers.js, WebGPU first, WASM fallback.
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
      asr = (await pipeline('automatic-speech-recognition', model, {
        device: webgpu ? 'webgpu' : 'wasm',
        dtype: webgpu ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : { encoder_model: 'q8', decoder_model_merged: 'q8' },
        progress_callback: (p: unknown) => ctx.postMessage({ type: 'progress', p })
      })) as unknown as Asr
      // Warm-up compiles the GPU shaders so the first real utterance is fast.
      await asr(new Float32Array(16_000))
      ctx.postMessage({ type: 'ready', device: webgpu ? 'webgpu' : 'wasm' })
    } else if (data.type === 'transcribe') {
      if (!asr) throw new Error('Speech recognition is not loaded')
      // English-only (.en) Whisper models must not get language/task options.
      const out = await asr(data.audio as Float32Array, { max_new_tokens: 128 })
      const text = (Array.isArray(out) ? out[0] : out).text.trim()
      ctx.postMessage({ type: 'result', id: data.id, text })
    }
  } catch (e) {
    ctx.postMessage({ type: 'error', id: data.id, message: e instanceof Error ? e.message : String(e) })
  }
}
