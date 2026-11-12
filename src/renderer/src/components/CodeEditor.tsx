import { useEffect, useRef } from 'react'
import { monaco, setupMonaco } from '../lib/monaco'
import { clangd } from '../lib/lsp'

export interface CodeEditorProps {
  /** Absolute path of the problem's main.cpp (clangd keys diagnostics and compile flags on it). */
  path: string
  initial: string
  onChange: (code: string) => void
  onRun: () => void
  onSubmit: () => void
}

export function CodeEditor({ path, initial, onChange, onRun, onSubmit }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const handlers = useRef({ onChange, onRun, onSubmit })
  handlers.current = { onChange, onRun, onSubmit }

  useEffect(() => {
    setupMonaco()
    const ed = monaco.editor.create(host.current!, {
      theme: 'okiro-dark',
      fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
      fontSize: 13.5,
      lineHeight: 21,
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorSmoothCaretAnimation: 'on',
      cursorBlinking: 'smooth',
      padding: { top: 14, bottom: 14 },
      tabSize: 4,
      automaticLayout: true,
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true },
      renderLineHighlight: 'all',
      quickSuggestions: { other: true, comments: false, strings: false },
      suggest: { showWords: false, preview: true },
      fixedOverflowWidgets: true
    })
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => handlers.current.onRun())
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => handlers.current.onSubmit())
    editor.current = ed
    return () => {
      const m = ed.getModel()
      if (m) clangd.close(m)
      ed.dispose()
      m?.dispose()
      editor.current = null
    }
  }, [])

  useEffect(() => {
    const ed = editor.current
    if (!ed) return
    const uri = monaco.Uri.file(path)
    const old = ed.getModel()
    if (old && old.uri.toString() !== uri.toString()) {
      clangd.close(old)
      old.dispose()
    }
    const model = monaco.editor.getModel(uri) ?? monaco.editor.createModel(initial, 'cpp', uri)
    if (model.getValue() !== initial) model.setValue(initial)
    ed.setModel(model)
    ed.focus()
    void clangd.start().then((ok) => ok && clangd.open(model))
    const sub = model.onDidChangeContent(() => {
      handlers.current.onChange(model.getValue())
      clangd.changed(model)
    })
    return () => sub.dispose()
  }, [path, initial])

  return <div ref={host} className="h-full w-full" />
}
