// Splits a statement's plain text into its Codeforces sections (pure).
export interface StatementParts {
  legend: string
  input: string
  output: string
  interaction: string
  examples: string
  note: string
}

const HEADINGS: [RegExp, keyof StatementParts][] = [
  [/^input$/i, 'input'],
  [/^output$/i, 'output'],
  [/^interaction$/i, 'interaction'],
  [/^examples?$/i, 'examples'],
  [/^notes?$/i, 'note']
]

export function splitStatement(text: string): StatementParts {
  const parts: StatementParts = { legend: '', input: '', output: '', interaction: '', examples: '', note: '' }
  let cur: keyof StatementParts = 'legend'
  for (const line of text.split('\n')) {
    const h = HEADINGS.find(([re]) => re.test(line.trim()))
    if (h) {
      cur = h[1]
      continue
    }
    parts[cur] += `${line}\n`
  }
  for (const k of Object.keys(parts) as (keyof StatementParts)[]) parts[k] = parts[k].trim()
  return parts
}
