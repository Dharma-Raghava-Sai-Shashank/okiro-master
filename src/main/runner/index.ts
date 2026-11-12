import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CompileDiagnostic, CustomRunResult, RunResponse, TestResult, Verdict } from '@shared/types'
import { getSettings } from '../settings'
import { binDir, includeDir, workDir } from '../paths'
import { check } from './checker'
import { parseDiagnostics } from './diagnostics'

const OUTPUT_CAP = 64 * 1024 * 1024
const STDERR_CAP = 64 * 1024

export interface ExecResult {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  timeMs: number
  timedOut: boolean
}

export function exec(cmd: string, args: string[], input: string, timeoutMs: number, cwd?: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint()
    const child = spawn(cmd, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
    const out: Buffer[] = []
    const err: Buffer[] = []
    let outLen = 0
    let errLen = 0
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)
    child.stdout.on('data', (d: Buffer) => {
      outLen += d.length
      if (outLen <= OUTPUT_CAP) out.push(d)
      else child.kill('SIGKILL')
    })
    child.stderr.on('data', (d: Buffer) => {
      if (errLen < STDERR_CAP) err.push(d)
      errLen += d.length
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ code: -1, signal: null, stdout: '', stderr: e.message, timeMs: 0, timedOut: false })
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({
        code,
        signal,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8').slice(0, STDERR_CAP),
        timeMs: Number(process.hrtime.bigint() - start) / 1e6,
        timedOut
      })
    })
    child.stdin.on('error', () => undefined)
    child.stdin.end(input)
  })
}

export function compileFlags(): string[] {
  const s = getSettings()
  return [`-std=${s.cppStd}`, ...s.extraFlags.split(/\s+/).filter(Boolean), '-DLOCAL', `-I${includeDir()}`]
}

/** Compile C++ source, caching binaries by (source, flags, compiler). */
export async function compile(source: string): Promise<{ binary?: string; error?: string; diagnostics?: CompileDiagnostic[] }> {
  const s = getSettings()
  const flags = compileFlags()
  const hash = createHash('sha256').update(s.compilerPath).update(flags.join(' ')).update(source).digest('hex').slice(0, 24)
  const binary = join(binDir(), hash)
  if (existsSync(binary)) return { binary }
  const src = join(binDir(), `${hash}.cpp`)
  writeFileSync(src, source)
  const r = await exec(s.compilerPath, [...flags, src, '-o', binary], '', 60_000)
  if (r.code !== 0) {
    const error = (r.stderr || r.stdout || 'Compilation failed').replaceAll(src, 'main.cpp')
    return { error, diagnostics: parseDiagnostics(error) }
  }
  return { binary }
}

export interface RunTest {
  id: number
  input: string
  expected: string
}

export interface RunOptions {
  timeLimitMs: number
  anyCase: boolean
}

export function verdictOf(r: ExecResult, ok: boolean): Verdict {
  if (r.timedOut) return 'TLE'
  if (r.code !== 0 || r.signal) return 'RE'
  return ok ? 'AC' : 'WA'
}

export async function runTests(source: string, tests: RunTest[], opts: RunOptions): Promise<RunResponse> {
  const c = await compile(source)
  if (!c.binary) return { compileError: c.error, diagnostics: c.diagnostics, results: [] }
  const limit = Math.round(opts.timeLimitMs * 1.5) + 300
  const results: TestResult[] = []
  for (const t of tests) {
    const r = await exec(c.binary, [], t.input, limit, workDir())
    const hasExpected = t.expected.trim().length > 0
    const verdictCheck = hasExpected ? check(r.stdout, t.expected, { anyCase: opts.anyCase, epsilon: 1e-6 }) : { ok: true }
    let verdict = verdictOf(r, verdictCheck.ok)
    if (verdict === 'AC' && !hasExpected) verdict = 'SKIP'
    results.push({
      testId: t.id,
      verdict,
      timeMs: Math.round(r.timeMs),
      output: r.stdout.slice(0, 20000),
      stderr: r.stderr,
      expected: t.expected,
      input: t.input,
      message:
        verdict === 'WA'
          ? verdictCheck.message
          : verdict === 'RE'
            ? `Exit code ${r.code ?? ''}${r.signal ? ` (${r.signal})` : ''}`
            : verdict === 'TLE'
              ? `Exceeded ${limit} ms`
              : verdict === 'SKIP'
                ? 'No expected output to compare against'
                : undefined
    })
  }
  return { results }
}

export async function runCustom(source: string, input: string, timeLimitMs: number): Promise<CustomRunResult> {
  const c = await compile(source)
  if (!c.binary) {
    return { compileError: c.error, diagnostics: c.diagnostics, stdout: '', stderr: '', timeMs: 0, exitCode: null, timedOut: false }
  }
  const r = await exec(c.binary, [], input.endsWith('\n') || !input ? input : `${input}\n`, Math.max(5000, timeLimitMs * 2), workDir())
  return {
    stdout: r.stdout.slice(0, 200_000),
    stderr: r.stderr,
    timeMs: Math.round(r.timeMs),
    exitCode: r.code,
    timedOut: r.timedOut
  }
}

export interface StressResult {
  ok: boolean
  iterations: number
  error?: string
  counterexample?: { input: string; expected: string; got: string; verdict: string }
}

/** Random testing: generator(seed) -> input; brute vs solution must agree. */
export async function stressTest(
  solution: string,
  brute: string,
  generator: string,
  iterations: number,
  opts: RunOptions
): Promise<StressResult> {
  const [sol, br, gen] = await Promise.all([compile(solution), compile(brute), compile(generator)])
  if (!sol.binary) return { ok: false, iterations: 0, error: `Solution compile error:\n${sol.error}` }
  if (!br.binary) return { ok: false, iterations: 0, error: `Brute force compile error:\n${br.error}` }
  if (!gen.binary) return { ok: false, iterations: 0, error: `Generator compile error:\n${gen.error}` }
  const deadline = Date.now() + 25_000
  let i = 0
  for (; i < iterations && Date.now() < deadline; i++) {
    const g = await exec(gen.binary, [String(i + 1)], '', 5000)
    if (g.code !== 0) return { ok: false, iterations: i, error: `Generator failed on seed ${i + 1}: ${g.stderr}` }
    const b = await exec(br.binary, [], g.stdout, 10_000)
    if (b.code !== 0 || b.timedOut) return { ok: false, iterations: i, error: `Brute force failed on seed ${i + 1}: ${b.stderr || 'timeout'}` }
    const s = await exec(sol.binary, [], g.stdout, Math.round(opts.timeLimitMs * 1.5) + 300)
    const c = check(s.stdout, b.stdout, { anyCase: opts.anyCase, epsilon: 1e-6 })
    const verdict = verdictOf(s, c.ok)
    if (verdict !== 'AC') {
      return { ok: false, iterations: i + 1, counterexample: { input: g.stdout, expected: b.stdout, got: s.stdout.slice(0, 4000), verdict } }
    }
  }
  return { ok: true, iterations: i }
}
