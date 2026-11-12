// Bridges clangd's stdio (LSP with Content-Length framing) to the renderer over IPC.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { WebContents } from 'electron'
import { compileFlags } from '../runner'
import { workDir } from '../paths'

let proc: ChildProcess | null = null
let target: WebContents | null = null
let buffer = Buffer.alloc(0)

function findClangd(): string | null {
  try {
    return execFileSync('xcrun', ['--find', 'clangd'], { encoding: 'utf8' }).trim()
  } catch {
    for (const p of ['/opt/homebrew/opt/llvm/bin/clangd', '/usr/local/opt/llvm/bin/clangd', '/usr/bin/clangd']) {
      try {
        execFileSync(p, ['--version'])
        return p
      } catch {
        // try next
      }
    }
  }
  return null
}

/** clangd from the Command Line Tools needs the SDK path to find libc++ and system headers. */
function sysrootFlags(): string[] {
  try {
    const sdk = execFileSync('xcrun', ['--show-sdk-path'], { encoding: 'utf8' }).trim()
    return sdk ? ['-isysroot', sdk] : []
  } catch {
    return []
  }
}

function onData(chunk: Buffer): void {
  buffer = Buffer.concat([buffer, chunk])
  for (;;) {
    const headerEnd = buffer.indexOf('\r\n\r\n')
    if (headerEnd < 0) return
    const m = /Content-Length: (\d+)/i.exec(buffer.subarray(0, headerEnd).toString('ascii'))
    if (!m) {
      buffer = buffer.subarray(headerEnd + 4)
      continue
    }
    const len = parseInt(m[1], 10)
    const start = headerEnd + 4
    if (buffer.length < start + len) return
    const body = buffer.subarray(start, start + len).toString('utf8')
    buffer = buffer.subarray(start + len)
    if (target && !target.isDestroyed()) target.send('lsp:message', body)
  }
}

export function startClangd(wc: WebContents): { workDir: string } | null {
  target = wc
  const dir = workDir()
  // clangd finds compile_flags.txt in any parent directory of the open file.
  writeFileSync(join(dir, 'compile_flags.txt'), ['-xc++', ...compileFlags(), ...sysrootFlags()].join('\n') + '\n')
  if (proc && proc.exitCode === null) {
    proc.kill()
  }
  const bin = findClangd()
  if (!bin) return null
  buffer = Buffer.alloc(0)
  proc = spawn(bin, ['--background-index=false', '--header-insertion=never', '--completion-style=detailed', '--log=error'], {
    cwd: dir,
    stdio: ['pipe', 'pipe', 'ignore']
  })
  proc.stdout?.on('data', onData)
  proc.on('exit', () => {
    proc = null
  })
  return { workDir: dir }
}

export function sendToClangd(message: string): void {
  if (!proc?.stdin?.writable) return
  const body = Buffer.from(message, 'utf8')
  proc.stdin.write(`Content-Length: ${body.length}\r\n\r\n`)
  proc.stdin.write(body)
}

export function stopClangd(): void {
  proc?.kill()
  proc = null
}
