import type { ContestType } from '@shared/types'

export function classifyContest(name: string): ContestType {
  if (/educational/i.test(name)) return 'edu'
  if (/global round/i.test(name)) return 'global'
  if (/div\.?\s*1\s*(\+|and)\s*div\.?\s*2/i.test(name)) return 'div12'
  const m = name.match(/div\.?\s*([1-4])/i)
  if (m) return `div${m[1]}` as ContestType
  return 'other'
}

/** Sort problem indexes the way Codeforces shows them: A, B, C1, C2, D, ... */
export function compareIndex(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true })
}

/** A problem's "level" for stats: C1/C2 both count as C. */
export function levelOf(index: string): string {
  return index.replace(/\d+$/, '')
}
