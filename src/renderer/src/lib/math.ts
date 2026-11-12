import katex from 'katex'

const decoder = document.createElement('textarea')
function decodeEntities(s: string): string {
  decoder.innerHTML = s
  return decoder.value
}

function tex(src: string, display: boolean): string {
  return katex.renderToString(decodeEntities(src), { displayMode: display, throwOnError: false, strict: 'ignore' })
}

/** Render Codeforces' $$$…$$$ (inline) and $$$$$$…$$$$$$ (display) math inside statement HTML. */
export function renderStatementMath(html: string): string {
  return html
    .replace(/\$\$\$\$\$\$([\s\S]+?)\$\$\$\$\$\$/g, (_m, s: string) => tex(s, true))
    .replace(/\$\$\$([\s\S]+?)\$\$\$/g, (_m, s: string) => tex(s, false))
}

/** Inline $…$ / $$…$$ math in chat text, returned as HTML. */
export function renderInlineMath(src: string, display = false): string {
  return katex.renderToString(src, { displayMode: display, throwOnError: false, strict: 'ignore' })
}
