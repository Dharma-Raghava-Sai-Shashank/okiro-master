import type { CompileDiagnostic } from '@shared/types'

/** Parse clang/gcc output ("main.cpp:12:5: error: …") into structured diagnostics. Pure; unit-tested. */
export function parseDiagnostics(output: string, file = 'main.cpp'): CompileDiagnostic[] {
  const out: CompileDiagnostic[] = []
  const esc = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^(?:.*[\\\\/])?${esc}:(\\d+):(\\d+):\\s*(fatal error|error|warning|note):\\s*(.*)$`)
  for (const line of output.split('\n')) {
    const m = re.exec(line.trim())
    if (!m) continue
    out.push({
      line: parseInt(m[1], 10),
      col: parseInt(m[2], 10),
      severity: m[3] === 'warning' ? 'warning' : m[3] === 'note' ? 'note' : 'error',
      message: m[4].trim()
    })
  }
  return out
}
