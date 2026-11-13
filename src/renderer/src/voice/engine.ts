// The voice conversation loop:
//   mic → VAD → Whisper → (instant command | Arjun) → sentence chunks → Kokoro → speaker
// with barge-in (talk over Arjun to interrupt), spoken confirmations, an idle timeout, and
// unloading of the speech models after a while to give memory back on small machines.
import SttWorker from './stt.worker?worker'
import TtsWorker from './tts.worker?worker'
import { problemScope } from '@shared/api'
import type { CoachAction, CoachEvent, Settings, UiActionRequest } from '@shared/types'
import { api } from '../lib/api'
import { useApp, useCoach } from '../lib/store'
import { useBridge } from './bridge'
import { useVoice } from './store'
import { Player } from './player'
import { Vad } from './vad'
import { SentenceChunker } from './speech'
import { matchConfirm, matchIntent } from './intents'
import { executeAction, type ActionContext } from './actions'
import type { LoadProgress } from './worker-types'

const IDLE_STOP_MS = 60_000
const UNLOAD_MS = 5 * 60_000
// Whisper's well-known outputs for silence and noise.
const NOISE = /^(\[.*\]|\(.*\)|thank you\.?|thanks for watching[.!]?|you\.?|bye\.?|\.+)$/i
// Pre-synthesized acknowledgements played the instant a question goes to the model (worker caches these).
export const FILLERS = ['Mm-hm.', 'Hmm, let me think.', 'Okay, one sec.', 'Let me see.']
const TOOL_CAPTION: Record<string, string> = {
  run_tests: 'Running your tests…',
  run_code: 'Trying some code…',
  stress_test: 'Stress testing your solution…',
  search_knowledge: 'Checking my notes…',
  get_editorial: 'Thinking about the intended solution…',
  get_user_history: 'Looking at your history…',
  app_action: 'On it…'
}

const set = (patch: Parameters<ReturnType<typeof useVoice.getState>['set']>[0]) => useVoice.getState().set(patch)
const settings = (): Settings | null => useApp.getState().settings
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// "okiro" the way speech recognition may spell it: "Okiro", "O'Kiro", "o kiro"…
const fuzzyWord = (w: string) =>
  w
    .split('')
    .map(escapeRe)
    .join("['\\s-]?")

interface Turn {
  scope: string
  turnId: string | null
  chunker: SentenceChunker
  done: boolean
}

class VoiceEngine {
  private stt: Worker | null = null
  private tts: Worker | null = null
  private sttLoad: Promise<void> | null = null
  private sttModel = ''
  private ttsReady = false
  private player: Player | null = null
  private vad = new Vad()
  private transcribeSeq = 0
  private transcribing = new Map<number, (text: string) => void>()
  private gen = 0
  private speakSeq = 0
  private pendingTts = 0
  private ttsText = new Map<number, string>()
  private turn: Turn | null = null
  private stopAfterSpeech = false
  private idleTimer: number | null = null
  private unloadTimer: number | null = null
  private progress = new Map<string, { loaded: number; total: number }>()
  private recentArjunPhrases: { text: string; time: number }[] = []
  private lastSpokenAt = 0
  private bargedIn = false
  private fillerIds = new Set<number>()
  private lastFiller = -1
  // Speech buffered across pauses until the send word ("okiro") is heard.
  private pendingUtterance = ''
  // One voice turn's latency marks: speech end → transcript → first LLM token → first audio out.
  private tm: { speechEnd: number; stt: number; firstToken: number; firstAudio: number } | null = null

  private markFirstAudio(): void {
    const m = this.tm
    if (!m || m.firstAudio) return
    m.firstAudio = performance.now()
    const d = (a: number, b: number) => (a && b ? Math.round(b - a) : -1)
    console.log(
      `[voice-timing] stt=${d(m.speechEnd, m.stt)}ms llm=${d(m.stt, m.firstToken)}ms tts=${d(m.firstToken || m.stt, m.firstAudio)}ms total=${d(m.speechEnd, m.firstAudio)}ms`
    )
  }

  private isEchoWindow(): boolean {
    if (this.player?.speaking || this.pendingTts > 0 || useVoice.getState().state === 'speaking') return true
    return Date.now() - this.lastSpokenAt < 600
  }

  private isEchoOfArjun(text: string): boolean {
    const clean = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
    if (!clean) return true
    const words = clean.split(/\s+/).filter((w) => w.length > 2)
    const now = Date.now()
    for (const phrase of this.recentArjunPhrases) {
      if (now - phrase.time > 20000) continue
      const target = phrase.text.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
      if (target.includes(clean) || clean.includes(target)) return true
      if (words.length > 0) {
        const targetWords = new Set(target.split(/\s+/))
        let matches = 0
        for (const w of words) {
          if (targetWords.has(w)) matches++
        }
        if (matches / words.length >= 0.5) return true
      }
    }
    return false
  }

  constructor() {
    api.on('coach:event', (e) => this.onCoach(e))
    api.on('coach:ui-action', (req) => void this.onUiAction(req))
  }

  get active(): boolean {
    const s = useVoice.getState().state
    return s !== 'off' && s !== 'error'
  }

  /** Output and input loudness for the visualizer. */
  levels(): { out: number; mic: number } {
    return { out: this.player?.level() ?? 0, mic: this.vad.micLevel() }
  }

  spectrum(out: Uint8Array<ArrayBuffer>): boolean {
    if (!this.player?.speaking) return false
    this.player.spectrum(out)
    return true
  }

  toggle(): void {
    if (this.active) void this.stop()
    else void this.start()
  }

  async start(): Promise<void> {
    if (this.active || useVoice.getState().state === 'loading') return
    const s = settings()
    if (!s) return
    if (this.unloadTimer) window.clearTimeout(this.unloadTimer)
    set({ state: 'loading', error: '', captionUser: '', captionArjun: '', pendingConfirm: null })
    this.stopAfterSpeech = false
    try {
      if (!(await api.voice.requestMic())) {
        throw new Error('Microphone access is off. Allow Okiro in System Settings → Privacy & Security → Microphone.')
      }
      this.player ??= new Player()
      this.player.onIdle = () => this.maybeFinish()
      await this.player.resume()
      this.loadTts(s)
      await this.loadStt(s.sttModel)
      await this.vad.start({
        onSpeechStart: () => this.onSpeechStart(),
        onSpeechEnd: (audio) => void this.onSpeechEnd(audio),
        onMisfire: () => {
          this.bargedIn = false
          this.backToListening()
        }
      })
      set({ state: 'listening', loadProgress: null })
      this.armIdle()
      this.maybeGreet()
    } catch (e) {
      set({ state: 'error', error: e instanceof Error ? e.message : String(e), loadProgress: null })
      await this.vad.stop()
    }
  }

  async stop(): Promise<void> {
    this.interrupt()
    this.clearIdle()
    this.pendingUtterance = ''
    await this.vad.stop()
    set({ state: 'off', pendingConfirm: null, loadProgress: null })
    this.unloadTimer = window.setTimeout(() => this.unload(), UNLOAD_MS)
  }

  /** Stop Arjun talking (barge-in or "stop"), cancel his current reply. */
  interrupt(): void {
    this.gen++
    this.tts?.postMessage({ type: 'cancel', gen: this.gen })
    this.player?.stop()
    this.pendingTts = 0
    this.ttsText.clear()
    this.fillerIds.clear()
    if (this.turn) useCoach.getState().stop(this.turn.scope)
    this.turn = null
    this.vad.setArjunSpeaking(false)
  }

  /** Speak long content (a statement, a stats summary) sentence by sentence. */
  speakLong(text: string): void {
    const c = new SentenceChunker()
    for (const s of [...c.push(text), ...c.flush()]) this.say(s)
  }

  /** Ask Arjun something by voice from a button (e.g. "Explain" on the Problem pane). */
  async askArjun(action: CoachAction, text = ''): Promise<void> {
    if (!this.active) await this.start()
    if (!this.active) return
    this.interrupt()
    await this.ask(action, text)
  }

  /** Say a sample line in the selected voice (Settings preview). Works without the mic. */
  async preview(): Promise<void> {
    const s = settings()
    if (!s) return
    this.player ??= new Player()
    this.player.onIdle = () => this.maybeFinish()
    await this.player.resume()
    this.loadTts(s)
    this.interrupt()
    if (this.ttsReady || s.ttsVoice === 'system') this.say("Hey, I'm Arjun. Let's get you to Master.")
    else this.player.speakSystem('My real voice is still downloading — one moment.', s.ttsSpeed)
  }

  /** Run a typed/clicked command as if it had been spoken. */
  async command(text: string): Promise<void> {
    if (!this.active) await this.start()
    if (!this.active) return
    this.interrupt()
    set({ captionUser: text })
    await this.handleUtterance(text)
  }

  // ── models ──────────────────────────────────────────────────────────────

  private loadStt(model: string): Promise<void> {
    if (this.sttLoad && this.sttModel === model) return this.sttLoad
    this.stt?.terminate()
    this.sttLoad = null
    this.sttModel = model
    this.stt = new SttWorker()
    this.sttLoad = new Promise<void>((resolve, reject) => {
      this.stt!.onmessage = ({ data }: MessageEvent) => {
        if (data.type === 'progress') this.onProgress('stt', data.p as LoadProgress)
        else if (data.type === 'ready') {
          if (data.device) set({ sttDevice: data.device })
          resolve()
        } else if (data.type === 'result') {
          this.transcribing.get(data.id)?.(data.text)
          this.transcribing.delete(data.id)
        } else if (data.type === 'error') {
          if (data.id !== undefined && this.transcribing.has(data.id)) {
            this.transcribing.get(data.id)!('')
            this.transcribing.delete(data.id)
          } else reject(new Error(`Speech recognition failed to load: ${data.message}`))
        }
      }
    }).catch((e: Error) => {
      this.sttLoad = null
      this.stt?.terminate()
      this.stt = null
      throw e
    })
    this.stt.postMessage({ type: 'load', model, ortBase: new URL('./ort/', document.baseURI).href })
    return this.sttLoad
  }

  private loadTts(s: Settings): void {
    if (s.ttsVoice === 'system') {
      set({ systemVoice: true })
      return
    }
    set({ systemVoice: false })
    if (this.tts) return
    this.tts = new TtsWorker()
    this.tts.onmessage = ({ data }: MessageEvent) => {
      if (data.type === 'progress') this.onProgress('tts', data.p as LoadProgress)
      else if (data.type === 'ready') {
        this.ttsReady = true
        set({ ttsDevice: data.device ?? '' })
      } else if (data.type === 'audio') this.onAudio(data)
      else if (data.type === 'error') {
        if (data.id !== undefined && this.ttsText.has(data.id)) {
          // One sentence failed to synthesize: show it as a caption and move on. Never switch
          // voices mid-reply — Arjun keeps one voice.
          const text = this.ttsText.get(data.id)!
          this.ttsText.delete(data.id)
          this.pendingTts = Math.max(0, this.pendingTts - 1)
          if (!this.fillerIds.delete(data.id)) set({ captionArjun: text })
          this.maybeFinish()
        } else {
          // The model itself failed to load: use the system voice for this session.
          set({ systemVoice: true })
        }
      }
    }
    this.tts.postMessage({ type: 'load', ortBase: new URL('./ort/', document.baseURI).href, voice: s.ttsVoice })
  }

  private unload(): void {
    this.stt?.terminate()
    this.tts?.terminate()
    this.stt = null
    this.tts = null
    this.sttLoad = null
    this.ttsReady = false
  }

  private onProgress(kind: string, p: LoadProgress): void {
    if (p.status !== 'progress' || !p.file || !p.total) return
    this.progress.set(`${kind}:${p.file}`, { loaded: p.loaded ?? 0, total: p.total })
    let loaded = 0
    let total = 0
    for (const v of this.progress.values()) {
      loaded += v.loaded
      total += v.total
    }
    const done = total > 0 && loaded >= total
    set({ loadProgress: done ? null : loaded / total, loadLabel: `Downloading Arjun's voice · ${Math.round(total / 1e6)} MB` })
  }

  // ── listening ───────────────────────────────────────────────────────────

  private onSpeechStart(): void {
    this.clearIdle()
    const st = useVoice.getState().state
    if (st === 'speaking' || st === 'thinking') {
      // Barge-in: while Arjun talks the VAD needs 0.85 + sustained speech, so this is the student.
      this.bargedIn = true
      this.interrupt()
    }
    set({ state: 'listening', captionUser: '…' })
  }

  private async onSpeechEnd(audio: Float32Array): Promise<void> {
    const barged = this.bargedIn
    this.bargedIn = false
    if (!barged && this.isEchoWindow()) {
      this.backToListening()
      return
    }
    if (!this.stt) return
    this.tm = { speechEnd: performance.now(), stt: 0, firstToken: 0, firstAudio: 0 }
    set({ state: 'transcribing' })
    const id = ++this.transcribeSeq
    const text = await new Promise<string>((resolve) => {
      this.transcribing.set(id, resolve)
      this.stt!.postMessage({ type: 'transcribe', id, audio }, [audio.buffer])
    })
    if (this.tm) this.tm.stt = performance.now()
    if (!this.active) return
    if (!text || NOISE.test(text.trim()) || this.isEchoOfArjun(text)) {
      this.backToListening()
      return
    }

    // Send-word mode: keep listening through pauses; only hand the whole thing to Arjun
    // once the send word ("okiro") ends an utterance. Instant commands and yes/no
    // confirmations still work on their own, without the word.
    const endWord = (settings()?.endWord ?? '').trim()
    if (endWord && !useVoice.getState().pendingConfirm) {
      const re = new RegExp(`[\\s,]*\\b${fuzzyWord(endWord)}\\b[\\s.!?,]*$`, 'i')
      const combined = this.pendingUtterance ? `${this.pendingUtterance} ${text}` : text
      if (!re.test(text)) {
        if (!this.pendingUtterance && matchIntent(text)) {
          // A lone quick command ("run the tests", "stop") executes immediately.
          set({ captionUser: text })
          await this.handleUtterance(text)
          return
        }
        this.pendingUtterance = combined
        set({ captionUser: `${combined} …` })
        this.backToListening()
        return
      }
      this.pendingUtterance = ''
      const full = combined.replace(re, '').trim()
      if (!full) {
        // They said just the word: nothing buffered, nothing to send.
        this.backToListening()
        return
      }
      set({ captionUser: full })
      await this.handleUtterance(full)
      return
    }

    set({ captionUser: text })
    await this.handleUtterance(text)
  }

  private backToListening(): void {
    if (!this.active) return
    const st = useVoice.getState().state
    if (st === 'speaking' || st === 'thinking') return
    set({ state: 'listening' })
    this.armIdle()
  }

  private ctx(): ActionContext {
    return { voice: true, speakLong: (t) => this.speakLong(t) }
  }

  private async handleUtterance(text: string): Promise<void> {
    const pending = useVoice.getState().pendingConfirm
    if (pending) {
      set({ pendingConfirm: null })
      const yes = matchConfirm(text)
      if (yes !== null) {
        this.say(yes ? await executeAction(pending, this.ctx()) : 'Okay, not submitting.')
        return
      }
    }
    const intent = matchIntent(text)
    if (intent) {
      const t = intent.action.type
      if (t === 'stop_listening') {
        this.stopAfterSpeech = true
        this.say(intent.ack)
        return
      }
      if (t === 'stop_speaking') {
        this.interrupt()
        this.backToListening()
        return
      }
      set({ state: 'thinking' })
      const result = await executeAction(intent.action, this.ctx())
      if (t === 'read_problem' || t === 'stats_summary') {
        if (!this.player?.speaking && this.pendingTts === 0) this.say(result)
        return
      }
      const spoken = intent.ack || result
      if (spoken) this.say(spoken)
      else this.backToListening()
      return
    }
    await this.ask('chat', text)
  }

  // ── talking to Arjun ────────────────────────────────────────────────────

  private async ask(action: CoachAction, text: string): Promise<void> {
    const ws = useBridge.getState().workspace
    const scope = ws ? problemScope(ws.ref) : 'home'
    this.gen++
    this.tts?.postMessage({ type: 'begin', gen: this.gen })
    this.turn = { scope, turnId: null, chunker: new SentenceChunker(), done: false }
    set({ state: 'thinking', captionArjun: '' })
    if (action !== 'greet') this.sayFiller()
    await useCoach.getState().send({
      scope,
      problem: ws?.ref,
      text,
      action,
      code: ws?.getCode(),
      provider: useApp.getState().provider,
      lastRun: ws?.lastRun(),
      voice: true
    })
  }

  private maybeGreet(): void {
    const today = new Date().toDateString()
    let last = ''
    try {
      last = localStorage.getItem('okiro.voiceGreeted') ?? ''
      localStorage.setItem('okiro.voiceGreeted', today)
    } catch {
      // storage unavailable: greet anyway
    }
    const onHome = window.location.hash === '' || window.location.hash === '#/' || window.location.hash === '#'
    if (last !== today && onHome) void this.ask('greet', '')
  }

  private onCoach(e: CoachEvent): void {
    const t = this.turn
    if (!t || e.scope !== t.scope) return
    if (t.turnId === null) t.turnId = e.turnId
    else if (e.turnId !== t.turnId) return
    switch (e.type) {
      case 'text':
        if (this.tm && !this.tm.firstToken) this.tm.firstToken = performance.now()
        for (const s of t.chunker.push(e.delta)) this.say(s)
        break
      case 'tool-start':
        if (!this.player?.speaking) set({ captionArjun: TOOL_CAPTION[e.name] ?? 'Working on it…' })
        break
      case 'done':
        for (const s of t.chunker.flush()) this.say(s)
        t.done = true
        this.maybeFinish()
        break
      case 'error':
        t.done = true
        if (/abort|cancel/i.test(e.error)) {
          this.maybeFinish()
          break
        }
        this.say(/ollama|fetch|ECONNREFUSED/i.test(e.error) ? "I can't reach my local model. Check Ollama in Settings." : "Sorry, something went wrong on my side.")
        break
    }
  }

  private async onUiAction(req: UiActionRequest): Promise<void> {
    const result = await executeAction(req.action, { voice: this.active, speakLong: (t) => this.speakLong(t) })
    await api.coach.uiResult(req.id, result || 'Done.')
  }

  // ── speaking ────────────────────────────────────────────────────────────

  /** An instant "I heard you" while the model works — dead air is what makes it feel slow. */
  private sayFiller(): void {
    if (!this.player || !this.ttsReady || !this.tts || useVoice.getState().systemVoice) return
    let idx = Math.floor(Math.random() * FILLERS.length)
    if (idx === this.lastFiller) idx = (idx + 1) % FILLERS.length
    this.lastFiller = idx
    const text = FILLERS[idx]
    this.lastSpokenAt = Date.now()
    this.recentArjunPhrases.push({ text, time: Date.now() })
    this.vad.setArjunSpeaking(true)
    const id = ++this.speakSeq
    this.pendingTts++
    this.ttsText.set(id, text)
    this.fillerIds.add(id)
    this.tts.postMessage({ type: 'filler', gen: this.gen, id, idx, voice: settings()?.ttsVoice ?? 'af_heart' })
  }

  private say(text: string): void {
    if (!text.trim() || !this.player) return
    this.clearIdle()
    this.lastSpokenAt = Date.now()
    this.recentArjunPhrases.push({ text, time: Date.now() })
    if (this.recentArjunPhrases.length > 30) this.recentArjunPhrases.shift()
    this.vad.setArjunSpeaking(true)
    const s = settings()
    const speed = s?.ttsSpeed ?? 1
    if (useVoice.getState().systemVoice || !this.tts) {
      set({ state: 'speaking', captionArjun: text })
      this.player.speakSystem(text, speed)
      this.markFirstAudio()
      return
    }
    // Kokoro still loading: queue anyway — the worker speaks it after the load finishes,
    // so Arjun always sounds like herself instead of switching voices mid-conversation.
    set({ state: 'speaking' })
    const id = ++this.speakSeq
    this.pendingTts++
    this.ttsText.set(id, text)
    this.tts.postMessage({ type: 'speak', gen: this.gen, id, text, voice: s?.ttsVoice ?? 'af_heart', speed })
  }

  private onAudio(data: { gen: number; id: number; pcm: Float32Array; sr: number; synthMs: number }): void {
    if (data.gen !== this.gen) return
    this.pendingTts = Math.max(0, this.pendingTts - 1)
    const text = this.ttsText.get(data.id) ?? ''
    this.ttsText.delete(data.id)
    set({ captionArjun: text })
    this.player?.play(data.pcm, data.sr)
    if (this.fillerIds.delete(data.id)) return // a filler isn't the reply's first audio
    this.markFirstAudio()
  }

  private maybeFinish(): void {
    if (this.pendingTts > 0 || this.player?.speaking) return
    this.lastSpokenAt = Date.now()
    if (this.turn && !this.turn.done) {
      // Silence while the model works: drop the barge-in bar so normal speech gets through.
      this.vad.setArjunSpeaking(false)
      set({ state: 'thinking' })
      return
    }
    this.turn = null
    this.vad.setArjunSpeaking(false)
    if (!this.active) return
    if (this.stopAfterSpeech || (!settings()?.autoListen && !useVoice.getState().pendingConfirm)) {
      void this.stop()
      return
    }
    set({ state: 'listening', captionUser: useVoice.getState().captionUser === '…' ? '' : useVoice.getState().captionUser })
    this.armIdle()
  }

  private armIdle(): void {
    this.clearIdle()
    this.idleTimer = window.setTimeout(() => {
      // Mid-thought (buffered speech waiting for the send word): stay on and keep listening.
      if (this.pendingUtterance) this.armIdle()
      else if (useVoice.getState().state === 'listening') void this.stop()
    }, IDLE_STOP_MS)
  }

  private clearIdle(): void {
    if (this.idleTimer) window.clearTimeout(this.idleTimer)
    this.idleTimer = null
  }
}

export const voice = new VoiceEngine()
