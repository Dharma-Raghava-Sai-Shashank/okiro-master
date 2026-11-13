// Plays Arjun's voice: gap-free scheduling of Kokoro PCM chunks through Web Audio, with an output
// level for the orb. Falls back to the macOS system voice (speechSynthesis).

export class Player {
  readonly ctx = new AudioContext({ latencyHint: 'interactive' })
  private readonly analyser: AnalyserNode
  private readonly data: Uint8Array<ArrayBuffer>
  private next = 0
  private live = new Set<AudioBufferSourceNode>()
  private systemSpeaking = 0
  onIdle?: () => void

  constructor() {
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 256
    this.analyser.connect(this.ctx.destination)
    this.data = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount))
  }

  get speaking(): boolean {
    return this.live.size > 0 || this.systemSpeaking > 0
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume()
  }

  /** `gapMs` adds a breath of silence after this chunk (slow, paced reading). */
  play(pcm: Float32Array, sampleRate: number, gapMs = 0): void {
    const buf = this.ctx.createBuffer(1, pcm.length, sampleRate)
    buf.getChannelData(0).set(pcm)
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.connect(this.analyser)
    const at = Math.max(this.ctx.currentTime + 0.03, this.next)
    src.start(at)
    this.next = at + buf.duration + gapMs / 1000
    this.live.add(src)
    src.onended = () => {
      this.live.delete(src)
      this.checkIdle()
    }
  }

  /** Speak with the macOS voice (fallback when Kokoro is unavailable or too slow). */
  speakSystem(text: string, rate: number): void {
    const u = new SpeechSynthesisUtterance(text)
    const voice = pickSystemVoice()
    if (voice) u.voice = voice
    u.rate = rate
    this.systemSpeaking++
    const done = () => {
      this.systemSpeaking = Math.max(0, this.systemSpeaking - 1)
      this.checkIdle()
    }
    u.onend = done
    u.onerror = done
    speechSynthesis.speak(u)
  }

  stop(): void {
    for (const s of this.live) {
      try {
        s.stop()
      } catch {
        // already stopped
      }
    }
    this.live.clear()
    this.next = 0
    if (this.systemSpeaking) {
      this.systemSpeaking = 0
      speechSynthesis.cancel()
    }
  }

  /** 0..1 output loudness for the visualizer. */
  level(): number {
    if (this.systemSpeaking) return 0.35 + 0.25 * Math.abs(Math.sin(performance.now() / 120))
    if (!this.live.size) return 0
    this.analyser.getByteTimeDomainData(this.data)
    let sum = 0
    for (const v of this.data) sum += ((v - 128) / 128) ** 2
    return Math.min(1, Math.sqrt(sum / this.data.length) * 4)
  }

  spectrum(out: Uint8Array<ArrayBuffer>): void {
    this.analyser.getByteFrequencyData(out)
  }

  private checkIdle(): void {
    if (!this.speaking) this.onIdle?.()
  }
}

let systemVoices: SpeechSynthesisVoice[] = []
if (typeof speechSynthesis !== 'undefined') {
  systemVoices = speechSynthesis.getVoices()
  speechSynthesis.addEventListener('voiceschanged', () => {
    systemVoices = speechSynthesis.getVoices()
  })
}

function pickSystemVoice(): SpeechSynthesisVoice | null {
  // Female voices, matching Arjun's Kokoro default (af_heart).
  const prefer = ['Samantha', 'Ava', 'Kate', 'Karen', 'Moira', 'Tessa']
  for (const name of prefer) {
    const v = systemVoices.find((x) => x.name.startsWith(name))
    if (v) return v
  }
  return systemVoices.find((v) => v.lang.startsWith('en')) ?? null
}
