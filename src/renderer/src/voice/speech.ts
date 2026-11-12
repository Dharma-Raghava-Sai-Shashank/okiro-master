// Turns Arjun's streamed markdown into sentences that sound right when spoken.
// Pure (no DOM, no audio) so it can be unit-tested.

const WORD_NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const say = (n: string) => WORD_NUM[Number(n)] ?? n

/** Markdown + TeX + symbols → plain speakable text. */
export function toSpeakable(text: string): string {
  let t = text
  // Code blocks are shown, not read.
  t = t.replace(/```[\s\S]*?(```|$)/g, ' I have put the code on screen. ')
  t = t.replace(/`([^`]+)`/g, '$1')
  // Markdown structure
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '')
  t = t.replace(/^\s*[-*•]\s+/gm, '')
  t = t.replace(/^\s*(\d+)[.)]\s+/gm, '$1, ')
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1')
  t = t.replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2').replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?])/g, '$1$2')
  // Math
  t = t.replace(/\$\$?/g, '')
  t = t.replace(/\\(?:text|mathrm|mathit|operatorname)\{([^}]*)\}/g, '$1')
  t = t.replace(/\\lfloor|\\rfloor/g, ' floor ').replace(/\\lceil|\\rceil/g, ' ceiling ')
  t = t.replace(/(\d+)\s*(?:\\cdot|·|×|\*)\s*10\s*\^\s*\{?(\d+)\}?/g, (_m, a: string, e: string) => `${say(a)} times ten to the ${say(e)}`)
  t = t.replace(/10\s*\^\s*\{?(\d+)\}?/g, (_m, e: string) => `ten to the ${say(e)}`)
  t = t.replace(/\^\s*\{?2\}?(?![0-9])/g, ' squared').replace(/\^\s*\{?3\}?(?![0-9])/g, ' cubed')
  t = t.replace(/\^\s*\{?([a-z0-9+-]+)\}?/gi, ' to the $1')
  t = t.replace(/([A-Za-z])_\{?([A-Za-z0-9]+)\}?/g, '$1 $2')
  t = t.replace(/O\(([^)]*)\)/g, 'O of $1')
  t = t.replace(/\\le(?:q)?|≤|<=/g, ' at most ').replace(/\\ge(?:q)?|≥|>=/g, ' at least ')
  t = t.replace(/\\ne(?:q)?|≠|!=/g, ' not equal to ')
  t = t.replace(/\\cdot|·|×/g, ' times ').replace(/\\log/g, 'log').replace(/\\sum/g, 'the sum of')
  t = t.replace(/\\oplus|⊕/g, ' xor ').replace(/\\bmod|\\mod/g, ' mod ')
  t = t.replace(/->|→|⇒|=>/g, ' to ').replace(/&/g, ' and ')
  t = t.replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, '')
  // Emoji and leftovers
  t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
  t = t.replace(/[|#>]/g, ' ')
  return t.replace(/\s+/g, ' ').trim()
}

/**
 * Streams sentences out of incoming text deltas. Holds text inside an unfinished code fence until it
 * closes, and avoids splitting on decimals ("1.5") or common abbreviations ("e.g.").
 */
export class SentenceChunker {
  private buf = ''

  push(delta: string): string[] {
    this.buf += delta
    return this.drain(false)
  }

  flush(): string[] {
    return this.drain(true)
  }

  private drain(final: boolean): string[] {
    const out: string[] = []
    for (;;) {
      const fences = this.buf.match(/```/g)?.length ?? 0
      // Only look at text before an unclosed fence.
      const openFence = fences % 2 === 1 ? this.buf.lastIndexOf('```') : -1
      const scan = openFence >= 0 ? this.buf.slice(0, openFence) : this.buf
      const end = findBoundary(scan)
      if (end > 0) {
        const raw = this.buf.slice(0, end)
        this.buf = this.buf.slice(end)
        const spoken = toSpeakable(raw)
        if (spoken) out.push(spoken)
        continue
      }
      if (openFence < 0 && scan.length > 220) {
        // Long run-on text: break at the last comma or space so speech can start.
        const cut = Math.max(scan.lastIndexOf(', ', 200), scan.lastIndexOf(' ', 200))
        if (cut > 40) {
          const spoken = toSpeakable(this.buf.slice(0, cut + 1))
          this.buf = this.buf.slice(cut + 1)
          if (spoken) out.push(spoken)
          continue
        }
      }
      break
    }
    if (final && this.buf.trim()) {
      const spoken = toSpeakable(this.buf)
      this.buf = ''
      if (spoken) out.push(spoken)
    }
    return out
  }
}

const ABBREV = /(?:e\.g|i\.e|etc|vs|approx|Mr|Dr)\.$/i

/** Index just past the first sentence end in `s`, or -1. A complete code fence counts as one unit. */
function findBoundary(s: string): number {
  const fence = /```[\s\S]*?```/g
  let m: RegExpExecArray | null
  const fences: [number, number][] = []
  while ((m = fence.exec(s))) fences.push([m.index, m.index + m[0].length])
  for (let i = 0; i < s.length; i++) {
    const inFence = fences.find(([a, b]) => i >= a && i < b)
    if (inFence) {
      // A code block ends a "sentence" (it becomes "I have put the code on screen").
      return inFence[1]
    }
    const c = s[i]
    if (c === '\n' && s[i + 1] === '\n') return i + 2
    if (c === '\n' && /^\s*([-*•]|\d+[.)])\s/.test(s.slice(i + 1))) return i + 1
    if (c === '.' || c === '!' || c === '?') {
      const next = s[i + 1]
      if (next === undefined) return -1 // might continue ("1." → "1.5")
      if (!/\s/.test(next)) continue
      if (c === '.' && /\d$/.test(s.slice(0, i)) && /^\s*\d/.test(s.slice(i + 1))) continue
      if (c === '.' && ABBREV.test(s.slice(0, i + 1))) continue
      const sentence = s.slice(0, i + 1).trim()
      if (sentence.split(/\s+/).length < 3 && i < s.length - 1 && !/[!?]/.test(c)) continue
      return i + 1
    }
  }
  return -1
}
