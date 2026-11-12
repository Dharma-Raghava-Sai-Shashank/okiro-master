// Small Markdown renderer for chat: fenced code, headings, lists, bold/italic, inline code,
// links and $math$. Tolerates half-streamed text (an unclosed fence renders as code).
import { Fragment, type ReactNode } from 'react'
import { renderInlineMath } from './math'

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\$\$[^$\n]+\$\$)|(\$[^$\n]+\$)|(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))|(\*[^*\n]+\*)|(_[^_\n]+_)/g

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0
    if (idx > last) out.push(text.slice(last, idx))
    const tok = m[0]
    const key = `${keyBase}-${i++}`
    if (m[1]) out.push(<code key={key}>{tok.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={key}>{inline(tok.slice(2, -2), key)}</strong>)
    else if (m[3]) out.push(<span key={key} dangerouslySetInnerHTML={{ __html: renderInlineMath(tok.slice(2, -2)) }} />)
    else if (m[4]) {
      // Avoid treating money-like "$5 and $10" as math: require no leading/trailing space inside.
      const inner = tok.slice(1, -1)
      if (/^\s|\s$/.test(inner)) out.push(tok)
      else out.push(<span key={key} dangerouslySetInnerHTML={{ __html: renderInlineMath(inner) }} />)
    } else if (m[5]) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!
      out.push(
        <a key={key} href={lm[2]} target="_blank" rel="noreferrer" className="text-blue-300 underline decoration-blue-300/40">
          {lm[1]}
        </a>
      )
    } else out.push(<em key={key}>{tok.slice(1, -1)}</em>)
    last = idx + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function blocks(text: string, keyBase: string): ReactNode[] {
  const lines = text.split('\n')
  const out: ReactNode[] = []
  let para: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let k = 0
  const key = () => `${keyBase}-b${k++}`
  const flushPara = () => {
    if (para.length) {
      const kk = key()
      out.push(
        <p key={kk}>
          {para.map((l, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {inline(l, `${kk}-${i}`)}
            </Fragment>
          ))}
        </p>
      )
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      const kk = key()
      const items = list.items.map((it, i) => <li key={i}>{inline(it, `${kk}-${i}`)}</li>)
      out.push(list.ordered ? <ol key={kk}>{items}</ol> : <ul key={kk}>{items}</ul>)
      list = null
    }
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line)
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (!line.trim()) {
      flushPara()
      flushList()
    } else if (h) {
      flushPara()
      flushList()
      const kk = key()
      const content = inline(h[2], kk)
      out.push(h[1].length === 1 ? <h1 key={kk}>{content}</h1> : h[1].length === 2 ? <h2 key={kk}>{content}</h2> : <h3 key={kk}>{content}</h3>)
    } else if (ul || ol) {
      flushPara()
      const ordered = !!ol
      if (list && list.ordered !== ordered) flushList()
      list ??= { ordered, items: [] }
      list.items.push((ul ?? ol)![1])
    } else if (list && /^\s{2,}/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()
  return out
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const parts: ReactNode[] = []
  const fence = /```([\w+-]*)\n?([\s\S]*?)(```|$)/g
  let last = 0
  let i = 0
  for (const m of text.matchAll(fence)) {
    const idx = m.index ?? 0
    if (idx > last) parts.push(...blocks(text.slice(last, idx), `t${i}`))
    parts.push(
      <pre key={`c${i}`}>
        <code>{m[2].replace(/\n$/, '')}</code>
      </pre>
    )
    last = idx + m[0].length
    i++
    if (!m[3]) break
  }
  if (last < text.length) parts.push(...blocks(text.slice(last), `t${i}`))
  return <div className={`md ${className ?? ''}`}>{parts}</div>
}
