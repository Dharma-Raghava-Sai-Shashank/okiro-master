// Microphone + voice activity detection (Silero VAD). Detects when the student starts and stops
// talking, hands each utterance (16 kHz Float32) to speech recognition, and exposes the mic level.
import { MicVAD } from '@ricky0123/vad-web'

export interface VadHandlers {
  onSpeechStart: () => void
  onSpeechEnd: (audio: Float32Array) => void
  onMisfire: () => void
}

export class Vad {
  private vad: MicVAD | null = null
  private mic = 0
  private arjunSpeaking = false
  private cooldownTimer: number | null = null

  async start(h: VadHandlers): Promise<void> {
    if (this.vad) {
      await this.vad.start()
      return
    }
    const base = new URL('./vad/', document.baseURI).href
    this.vad = await MicVAD.new({
      model: 'v5',
      baseAssetPath: base,
      onnxWASMBasePath: base,
      startOnLoad: false,
      positiveSpeechThreshold: 0.5,
      negativeSpeechThreshold: 0.35,
      minSpeechMs: 250,
      preSpeechPadMs: 300,
      redemptionMs: 700,
      getStream: () =>
        navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        }),
      onSpeechRealStart: () => {
        if (this.arjunSpeaking) return
        h.onSpeechStart()
      },
      onSpeechEnd: (audio) => {
        if (this.arjunSpeaking) return
        h.onSpeechEnd(audio)
      },
      onVADMisfire: () => {
        if (this.arjunSpeaking) return
        h.onMisfire()
      },
      onFrameProcessed: (_p, frame) => {
        let sum = 0
        for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i]
        this.mic = this.arjunSpeaking ? 0 : Math.min(1, Math.sqrt(sum / frame.length) * 8)
      }
    })
    await this.vad.start()
  }

  /** While Arjun talks, block microphone speech events and ignore speaker echo. */
  setArjunSpeaking(speaking: boolean): void {
    if (this.cooldownTimer !== null) {
      window.clearTimeout(this.cooldownTimer)
      this.cooldownTimer = null
    }
    if (speaking) {
      this.arjunSpeaking = true
      this.vad?.setOptions({ positiveSpeechThreshold: 0.85 })
    } else {
      // Keep arjunSpeaking = true for 500ms after audio playback ends to absorb room reverberation
      this.cooldownTimer = window.setTimeout(() => {
        this.arjunSpeaking = false
        this.vad?.setOptions({ positiveSpeechThreshold: 0.5 })
        this.cooldownTimer = null
      }, 500)
    }
  }

  micLevel(): number {
    return this.arjunSpeaking ? 0 : this.mic
  }

  async stop(): Promise<void> {
    if (this.cooldownTimer !== null) {
      window.clearTimeout(this.cooldownTimer)
      this.cooldownTimer = null
    }
    this.arjunSpeaking = false
    this.mic = 0
    await this.vad?.destroy()
    this.vad = null
  }
}
