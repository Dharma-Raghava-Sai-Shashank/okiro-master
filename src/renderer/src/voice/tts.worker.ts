// Text-to-speech: Kokoro-82M running on-device. Sentences are synthesized one at a time, in order;
// a cancel drops everything queued for an older reply (barge-in).
import { KokoroTTS, env as kokoroEnv, type GenerateOptions } from 'kokoro-js'
import { hasWebGpu, type WorkerScope } from './worker-types'

const ctx = self as unknown as WorkerScope
let tts: KokoroTTS | null = null
let current = 0
let chain: Promise<void> = Promise.resolve()

async function load(ortBase: string, voice: string): Promise<void> {
  kokoroEnv.wasmPaths = ortBase
  const webgpu = await hasWebGpu()
  tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
    dtype: webgpu ? 'fp32' : 'q8',
    device: webgpu ? 'webgpu' : 'wasm',
    progress_callback: (p: unknown) => ctx.postMessage({ type: 'progress', p })
  })
  await tts.generate('Ready.', { voice: voice as GenerateOptions['voice'] })
  ctx.postMessage({ type: 'ready', device: webgpu ? 'webgpu' : 'wasm' })
}

async function speak(gen: number, id: number, text: string, voice: string, speed: number): Promise<void> {
  if (gen !== current || !tts) return
  const started = performance.now()
  const audio = await tts.generate(text, { voice: voice as GenerateOptions['voice'], speed })
  if (gen !== current) return
  const pcm = audio.audio.slice()
  ctx.postMessage({ type: 'audio', gen, id, pcm, sr: audio.sampling_rate, synthMs: performance.now() - started }, [pcm.buffer])
}

ctx.onmessage = ({ data }: MessageEvent) => {
  if (data.type === 'cancel') {
    current = data.gen
    return
  }
  if (data.type === 'begin') {
    current = data.gen
    return
  }
  chain = chain
    .then(() => (data.type === 'load' ? load(data.ortBase, data.voice) : speak(data.gen, data.id, data.text, data.voice, data.speed)))
    .catch((e: unknown) => ctx.postMessage({ type: 'error', id: data.id, message: e instanceof Error ? e.message : String(e) }))
}
