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

  /** While Arjun talks, require stronger speech so his own voice doesn't trigger a barge-in. */
  setArjunSpeaking(speaking: boolean): void {
    this.vad?.setOptions({ positiveSpeechThreshold: speaking ? 0.75 : 0.5 })
  }

  micLevel(): number {
    return this.mic
  }

  async stop(): Promise<void> {
    this.mic = 0
    await this.vad?.destroy()
    this.vad = null
  }
}
