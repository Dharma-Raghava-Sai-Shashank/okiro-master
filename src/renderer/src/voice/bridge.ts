// The Workspace page registers what voice commands and Arjun's app_action tool can do on it.
import { create } from 'zustand'
import type { ProblemDetail, ProblemRef, RunResponse, TestCase } from '@shared/types'

export interface WorkspaceHandle {
  ref: ProblemRef
  problem: ProblemDetail | null
  tests: () => TestCase[]
  getCode: () => string
  lastRun: () => RunResponse | undefined
  runTests: (ids: number[] | null) => Promise<RunResponse>
  submit: () => Promise<void>
  toggleFocus: (on?: boolean) => void
}

interface BridgeStore {
  workspace: WorkspaceHandle | null
  register: (h: WorkspaceHandle | null) => void
}

export const useBridge = create<BridgeStore>((set) => ({
  workspace: null,
  register: (workspace) => set({ workspace })
}))
