import { create } from 'zustand'
import type { UiAction } from '@shared/types'

export type VoiceState = 'off' | 'loading' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'error'

interface VoiceStore {
  state: VoiceState
  /** What the student just said, and what Arjun is saying right now. */
  captionUser: string
  captionArjun: string
  error: string
  /** 0..1 download progress of the speech models (null when not downloading). */
  loadProgress: number | null
  loadLabel: string
  sttDevice: string
  ttsDevice: string
  systemVoice: boolean
  hudOpen: boolean
  chatOpen: boolean
  pendingConfirm: UiAction | null
  set: (patch: Partial<Omit<VoiceStore, 'set'>>) => void
}

export const useVoice = create<VoiceStore>((set) => ({
  state: 'off',
  captionUser: '',
  captionArjun: '',
  error: '',
  loadProgress: null,
  loadLabel: '',
  sttDevice: '',
  ttsDevice: '',
  systemVoice: false,
  hudOpen: false,
  chatOpen: false,
  pendingConfirm: null,
  set: (patch) => set(patch)
}))
