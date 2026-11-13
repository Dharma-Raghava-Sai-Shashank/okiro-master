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
  private cooldownTimer: number | null = null

  async start(h: VadHandlers): Promise<void> {
    if (this.vad) {
      await this.vad.start()
      return
    }
    const base = new URL('./vad/', document.baseURI).href
    this.vad = await MicVAD.new({
      model: 'v6',
      baseAssetPath: base,
      onnxWASMBasePath: base,
      startOnLoad: false,
      positiveSpeechThreshold: 0.5,
      negativeSpeechThreshold: 0.35,
      minSpeechMs: 250,
      preSpeechPadMs: 250,
      redemptionMs: 800,
      getStream: () =>
        navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        }),
      onSpeechRealStart: () => h.onSpeechStart(),
      onSpeechEnd: (audio) => h.onSpeechEnd(audio),
      onVADMisfire: () => h.onMisfire(),
      onFrameProcessed: (_p, frame) => {
        let sum = 0
        for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i]
        this.mic = Math.min(1, Math.sqrt(sum / frame.length) * 8)
      }
    })
    await this.vad.start()
  }

  /**
   * While Arjun talks, require strong sustained speech so his own voice (already reduced by the
   * OS echo canceller) can't trigger — but a real student talking over him still barges in.
   */
  setArjunSpeaking(speaking: boolean): void {
    if (this.cooldownTimer !== null) {
      window.clearTimeout(this.cooldownTimer)
      this.cooldownTimer = null
    }
    if (speaking) {
      this.vad?.setOptions({ positiveSpeechThreshold: 0.85 })
    } else {
      // Hold the high bar briefly after playback ends to absorb room reverberation.
      this.cooldownTimer = window.setTimeout(() => {
        this.vad?.setOptions({ positiveSpeechThreshold: 0.5 })
        this.cooldownTimer = null
      }, 400)
    }
  }

  micLevel(): number {
    return this.mic
  }

  async stop(): Promise<void> {
    if (this.cooldownTimer !== null) {
      window.clearTimeout(this.cooldownTimer)
      this.cooldownTimer = null
    }
    this.mic = 0
    await this.vad?.destroy()
    this.vad = null
  }
}
