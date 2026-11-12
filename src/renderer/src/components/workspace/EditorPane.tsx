import { useEffect, useMemo, useRef, useState } from 'react'
import { FileCode2, Minus, Plus, Search, Sparkles, Wand2 } from 'lucide-react'
import type { CompileDiagnostic } from '@shared/types'
import snippets from '../../../../../resources/snippets/cpp.json'
import template from '../../../../../resources/snippets/template.cpp?raw'
import { useApp } from '../../lib/store'
import { cx } from '../../lib/format'
import { CodeEditor, type EditorApi } from '../CodeEditor'
import { Spinner } from '../ui'

type Snippet = { prefix: string; description: string; body: string[] }
const SNIPPETS = Object.values(snippets as Record<string, Snippet>)

const loadFont = (): number => {
  try {
    return Number(localStorage.getItem('okiro.editorFont')) || 13.5
  } catch {
    return 13.5
  }
}

function SnippetPalette({ onPick, onClose }: { onPick: (s: Snippet) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return SNIPPETS.filter((s) => !t || s.prefix.includes(t) || s.description.toLowerCase().includes(t))
  }, [q])
  useEffect(() => setSel(0), [q])
  return (
    <div className="absolute inset-0 z-20 flex justify-center bg-black/40 pt-14" onClick={onClose}>
      <div className="glass-strong hud-in h-fit w-[420px] overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
          <Search className="size-4 text-slate-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setSel((s) => Math.min(list.length - 1, s + 1))
              else if (e.key === 'ArrowUp') setSel((s) => Math.max(0, s - 1))
              else if (e.key === 'Enter' && list[sel]) onPick(list[sel])
              else if (e.key === 'Escape') onClose()
            }}
            placeholder="Insert snippet: dsu, segtree, modint, dijkstra…"
            className="flex-1 bg-transparent text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {list.map((s, i) => (
            <button
              key={s.prefix}
              onMouseEnter={() => setSel(i)}
              onClick={() => onPick(s)}
              className={cx('flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left', i === sel ? 'bg-blue-500/20' : 'hover:bg-white/[0.04]')}
            >
              <span className="w-20 shrink-0 font-mono text-[12px] font-bold text-cyan-200">{s.prefix}</span>
              <span className="truncate text-[12px] text-slate-400">{s.description}</span>
            </button>
          ))}
          {list.length === 0 && <div className="py-6 text-center text-xs text-slate-500">No snippet matches</div>}
        </div>
      </div>
    </div>
  )
}

export interface EditorPaneProps {
  fileName: string
  path: string
  initial: string | null
  diagnostics?: CompileDiagnostic[]
  saving: boolean
  compileInfo: string
  onChange: (code: string) => void
  onRun: () => void
  onSubmit: () => void
  onApi: (api: EditorApi) => void
}

export function EditorPane({ fileName, path, initial, diagnostics, saving, compileInfo, onChange, onRun, onSubmit, onApi }: EditorPaneProps) {
  const { settings, updateSettings } = useApp()
  const [fontSize, setFontSize] = useState(loadFont)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [palette, setPalette] = useState(false)
  const [menu, setMenu] = useState(false)
  const api = useRef<EditorApi | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem('okiro.editorFont', String(fontSize))
    } catch {
      // ignore
    }
  }, [fontSize])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const errors = diagnostics?.filter((d) => d.severity === 'error').length ?? 0

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="ide-pane-head flex items-center gap-1.5 px-3">
        <FileCode2 className="size-3.5 text-blue-300" />
        <span className="font-mono text-[12px] font-semibold text-slate-200">{fileName}</span>
        <span className={cx('size-1.5 rounded-full', saving ? 'blink-dot bg-amber-300' : 'bg-emerald-400/70')} title={saving ? 'Saving…' : 'Saved'} />
        <div className="flex-1" />
        <div className="relative">
          <button onClick={() => setMenu(!menu)} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-slate-200">
            <Wand2 className="size-3.5" /> Template
          </button>
          {menu && (
            <div className="glass-strong absolute right-0 top-8 z-30 w-48 overflow-hidden rounded-xl p-1" onMouseLeave={() => setMenu(false)}>
              <button
                className="w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] text-slate-200 hover:bg-white/[0.06]"
                onClick={() => {
                  api.current?.insertSnippet(SNIPPETS.find((s) => s.prefix === 'cp')?.body.join('\n') ?? template)
                  setMenu(false)
                }}
              >
                Insert contest template
              </button>
              <button
                className="w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] text-rose-200 hover:bg-rose-500/10"
                onClick={() => {
                  if (window.confirm('Replace your code with the template? (Undo with ⌘Z)')) api.current?.setValue(template)
                  setMenu(false)
                }}
              >
                Reset to template
              </button>
            </div>
          )}
        </div>
        <button onClick={() => setPalette(true)} title="Snippets (⌘⇧P)" className="flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-slate-200">
          <Sparkles className="size-3.5" /> Snippets
        </button>
        <div className="mx-1 h-4 w-px bg-white/10" />
        <select
          value={settings?.cppStd ?? 'c++20'}
          onChange={(e) => void updateSettings({ cppStd: e.target.value })}
          className="rounded-md bg-transparent px-1 py-1 text-[11.5px] font-semibold text-slate-400 hover:text-slate-200 focus:outline-none"
          title="C++ standard"
        >
          {['c++17', 'c++20', 'c++23'].map((s) => (
            <option key={s} value={s}>
              {s.toUpperCase()}
            </option>
          ))}
        </select>
        <button onClick={() => setFontSize((f) => Math.max(11, f - 0.5))} className="rounded-md p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200" title="Smaller font">
          <Minus className="size-3" />
        </button>
        <span className="w-7 text-center text-[11px] tabular-nums text-slate-500">{fontSize}</span>
        <button onClick={() => setFontSize((f) => Math.min(20, f + 0.5))} className="rounded-md p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200" title="Larger font">
          <Plus className="size-3" />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {initial === null || !path ? (
          <div className="grid h-full place-items-center">
            <Spinner />
          </div>
        ) : (
          <CodeEditor
            path={path}
            initial={initial}
            fontSize={fontSize}
            diagnostics={diagnostics}
            onChange={onChange}
            onRun={onRun}
            onSubmit={onSubmit}
            onCursor={(line, col) => setCursor({ line, col })}
            onReady={(a) => {
              api.current = a
              onApi(a)
            }}
          />
        )}
      </div>

      <div className="flex h-6 items-center gap-3 border-t border-white/[0.06] bg-black/20 px-3 text-[10.5px] text-slate-500">
        <span className="tabular-nums">
          Ln {cursor.line}, Col {cursor.col}
        </span>
        {errors > 0 ? (
          <button className="font-semibold text-rose-300 hover:underline" onClick={() => {
            const d = diagnostics!.find((x) => x.severity === 'error')!
            api.current?.revealLine(d.line, d.col)
          }}>
            ✕ {errors} compile error{errors > 1 ? 's' : ''}
          </button>
        ) : (
          compileInfo && <span>{compileInfo}</span>
        )}
        <div className="flex-1" />
        <span>{settings?.compilerPath ?? 'clang++'} · {(settings?.cppStd ?? 'c++20').toUpperCase()}</span>
        <span>⌘↵ run · ⌘⇧↵ submit · ⌘⇧P snippets</span>
      </div>

      {palette && (
        <SnippetPalette
          onClose={() => setPalette(false)}
          onPick={(s) => {
            setPalette(false)
            api.current?.insertSnippet(s.body.join('\n'))
          }}
        />
      )}
    </div>
  )
}
