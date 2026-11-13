// Text-to-speech: Kokoro-82M running on-device. Sentences are synthesized one at a time, in order;
// a cancel drops everything queued for an older reply (barge-in).
import { KokoroTTS, env as kokoroEnv, type GenerateOptions } from 'kokoro-js'
import { hasWebGpu, type WorkerScope } from './worker-types'

// Keep in sync with FILLERS in engine.ts (indexed by `idx` in the filler message).
const FILLER_TEXTS = ['Mm-hm.', 'Hmm, let me think.', 'Okay, one sec.', 'Let me see.']

const ctx = self as unknown as WorkerScope
let tts: KokoroTTS | null = null
let current = 0
let chain: Promise<void> = Promise.resolve()
let fillers: { pcm: Float32Array; sr: number }[] = []
let fillerVoice = ''

async function load(ortBase: string, voice: string): Promise<void> {
  kokoroEnv.wasmPaths = ortBase
  const webgpu = await hasWebGpu()
  const make = () =>
    KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: webgpu ? 'fp32' : 'q8',
      device: webgpu ? 'webgpu' : 'wasm',
      progress_callback: (p: unknown) => ctx.postMessage({ type: 'progress', p })
    })
  try {
    tts = await make()
  } catch (e) {
    // Truncated bytes from an interrupted download poison the cache ("protobuf parsing failed"):
    // clear and fetch fresh, once.
    if (!/protobuf|corrupt|invalid/i.test(String(e))) throw e
    await caches.delete('transformers-cache')
    await caches.delete('kokoro-voices')
    tts = await make()
  }
  await tts.generate('Ready.', { voice: voice as GenerateOptions['voice'] })
  ctx.postMessage({ type: 'ready', device: webgpu ? 'webgpu' : 'wasm' })
  // Pre-synthesize the acknowledgement clips so they can play the instant a question lands.
  const clips: { pcm: Float32Array; sr: number }[] = []
  for (const text of FILLER_TEXTS) {
    const a = await tts.generate(text, { voice: voice as GenerateOptions['voice'] })
    clips.push({ pcm: a.audio.slice(), sr: a.sampling_rate })
  }
  fillers = clips
  fillerVoice = voice
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
  if (data.type === 'filler') {
    if (data.gen !== current) return
    const f = fillers[data.idx]
    if (f && fillerVoice === data.voice) {
      // Cached: skip the chain and answer instantly.
      const pcm = f.pcm.slice()
      ctx.postMessage({ type: 'audio', gen: data.gen, id: data.id, pcm, sr: f.sr, synthMs: 0 }, [pcm.buffer])
    } else {
      chain = chain
        .then(() => speak(data.gen, data.id, FILLER_TEXTS[data.idx] ?? 'Mm-hm.', data.voice, 1))
        .catch((e: unknown) => ctx.postMessage({ type: 'error', id: data.id, message: e instanceof Error ? e.message : String(e) }))
    }
    return
  }
  chain = chain
    .then(() => (data.type === 'load' ? load(data.ortBase, data.voice) : speak(data.gen, data.id, data.text, data.voice, data.speed)))
    .catch((e: unknown) => ctx.postMessage({ type: 'error', id: data.id, message: e instanceof Error ? e.message : String(e) }))
}
