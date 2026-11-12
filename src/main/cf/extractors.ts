/// <reference lib="dom" />
// These functions are serialized with .toString() and run inside a codeforces.com page,
// so each must be fully self-contained (no imports, no outer references).

export interface ExtractedProblem {
  error?: string
  title: string
  tl: string
  ml: string
  html: string
  text: string
  samples: { input: string; output: string }[]
  interactive: boolean
}

export function extractProblem(html: string): ExtractedProblem {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const st = doc.querySelector('.problem-statement')
  const empty = { title: '', tl: '', ml: '', html: '', text: '', samples: [], interactive: false }
  if (!st) return { ...empty, error: 'Problem statement not found on the page' }
  const header = st.querySelector('.header')
  const grab = (sel: string): string => {
    const el = header ? header.querySelector(sel) : null
    if (!el) return ''
    const c = el.cloneNode(true) as Element
    const t = c.querySelector('.property-title')
    if (t) t.remove()
    return (c.textContent || '').trim()
  }
  const preText = (pre: Element | undefined): string => {
    if (!pre) return ''
    const lines = pre.querySelectorAll('.test-example-line')
    let t: string
    if (lines.length) t = Array.from(lines).map((l) => l.textContent || '').join('\n')
    else {
      const c = pre.cloneNode(true) as Element
      c.querySelectorAll('br').forEach((b) => b.replaceWith('\n'))
      t = c.textContent || ''
    }
    t = t.replace(/\r/g, '').replace(/^\n+/, '')
    return t.endsWith('\n') ? t : t + '\n'
  }
  const samples: { input: string; output: string }[] = []
  st.querySelectorAll('.sample-test').forEach((s) => {
    const ins = Array.from(s.querySelectorAll('.input pre'))
    const outs = Array.from(s.querySelectorAll('.output pre'))
    ins.forEach((p, i) => samples.push({ input: preText(p), output: preText(outs[i]) }))
  })
  const body = st.cloneNode(true) as Element
  const h = body.querySelector('.header')
  if (h) h.remove()
  body.querySelectorAll('script, style, iframe, object, embed, form, input, button, link, meta').forEach((e) => e.remove())
  body.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) if (/^on/i.test(a.name) || a.name === 'style') el.removeAttribute(a.name)
    if (el.tagName === 'A') {
      el.setAttribute('href', new URL(el.getAttribute('href') || '#', 'https://codeforces.com').href)
      el.setAttribute('target', '_blank')
    }
    if (el.tagName === 'IMG') el.setAttribute('src', new URL(el.getAttribute('src') || '', 'https://codeforces.com').href)
  })
  const BLOCK = /^(P|DIV|UL|OL|PRE|H[1-6]|TABLE|TR|CENTER)$/
  const toText = (node: Node): string => {
    let out = ''
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) out += n.textContent || ''
      else if (n.nodeType === 1) {
        const tag = (n as Element).tagName
        if (tag === 'BR') out += '\n'
        else if (tag === 'LI') out += '\n- ' + toText(n).trim() + '\n'
        else if (BLOCK.test(tag)) out += '\n' + toText(n) + '\n'
        else out += toText(n)
      }
    })
    return out
  }
  const text = toText(body)
    .replace(/\$\$\$\$\$\$/g, () => '$$')
    .replace(/\$\$\$/g, () => '$')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const titles = Array.from(st.querySelectorAll('.section-title')).map((e) => (e.textContent || '').trim().toLowerCase())
  return {
    title: grab('.title'),
    tl: grab('.time-limit'),
    ml: grab('.memory-limit'),
    html: body.innerHTML,
    text,
    samples,
    interactive: titles.includes('interaction') || /this is an interactive problem/i.test(st.textContent || '')
  }
}

export function extractTutorialLinks(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: string[] = []
  doc.querySelectorAll('a[href*="/blog/entry/"]').forEach((a) => {
    const t = (a.textContent || '').toLowerCase()
    const href = a.getAttribute('href') || ''
    if (/tutorial|editorial|разбор/.test(t) && !out.includes(href)) out.push(href)
  })
  return out
}

export function extractBlogText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = doc.querySelector('.ttypography') || doc.querySelector('.content')
  if (!root) return ''
  root.querySelectorAll('script, style').forEach((e) => e.remove())
  const BLOCK = /^(P|DIV|UL|OL|PRE|H[1-6]|TABLE|TR|CENTER|BLOCKQUOTE)$/
  const toText = (node: Node): string => {
    let out = ''
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) out += n.textContent || ''
      else if (n.nodeType === 1) {
        const el = n as Element
        if (el.tagName === 'BR') out += '\n'
        else if (el.tagName === 'LI') out += '\n- ' + toText(n).trim() + '\n'
        else if (el.tagName === 'PRE') out += '\n```\n' + (el.textContent || '') + '\n```\n'
        else if (BLOCK.test(el.tagName)) out += '\n' + toText(n) + '\n'
        else out += toText(n)
      }
    })
    return out
  }
  return toText(root)
    .replace(/\$\$\$\$\$\$/g, () => '$$')
    .replace(/\$\$\$/g, () => '$')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
