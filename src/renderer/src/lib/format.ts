// Codeforces rank colours, tuned for a dark background.
export function ratingColor(rating: number | null | undefined): string {
  if (rating == null) return '#94a3b8'
  if (rating < 1200) return '#a3adbd'
  if (rating < 1400) return '#4ade80'
  if (rating < 1600) return '#22d3ee'
  if (rating < 1900) return '#60a5fa'
  if (rating < 2100) return '#c084fc'
  if (rating < 2400) return '#fb923c'
  return '#f87171'
}

export function rankName(rating: number | null | undefined): string {
  if (rating == null) return 'Unrated'
  if (rating < 1200) return 'Newbie'
  if (rating < 1400) return 'Pupil'
  if (rating < 1600) return 'Specialist'
  if (rating < 1900) return 'Expert'
  if (rating < 2100) return 'Candidate Master'
  if (rating < 2300) return 'Master'
  if (rating < 2400) return 'International Master'
  return 'Grandmaster'
}

export function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseIso(s: string): Date {
  return new Date(`${s}T00:00:00`)
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export const VERDICT_LABEL: Record<string, string> = {
  OK: 'Accepted',
  WRONG_ANSWER: 'Wrong answer',
  TIME_LIMIT_EXCEEDED: 'Time limit exceeded',
  MEMORY_LIMIT_EXCEEDED: 'Memory limit exceeded',
  RUNTIME_ERROR: 'Runtime error',
  COMPILATION_ERROR: 'Compilation error',
  IDLENESS_LIMIT_EXCEEDED: 'Idleness limit exceeded',
  TESTING: 'Testing…',
  CHALLENGED: 'Hacked',
  SKIPPED: 'Skipped'
}

export const cx = (...xs: (string | false | null | undefined)[]): string => xs.filter(Boolean).join(' ')
