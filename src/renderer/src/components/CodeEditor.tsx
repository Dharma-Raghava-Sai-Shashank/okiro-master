import { useEffect, useRef } from 'react'
import type { CompileDiagnostic } from '@shared/types'
import { monaco, setupMonaco } from '../lib/monaco'
import { clangd } from '../lib/lsp'

export interface EditorApi {
  /** Insert a VS Code-style snippet at the cursor. */
  insertSnippet: (body: string) => void
  setValue: (code: string) => void
  revealLine: (line: number, col?: number) => void
  focus: () => void
}

export interface CodeEditorProps {
  /** Absolute path of the problem's main.cpp (clangd keys diagnostics and compile flags on it). */
  path: string
  initial: string
  fontSize: number
  diagnostics?: CompileDiagnostic[]
  onChange: (code: string) => void
  onRun: () => void
  onSubmit: () => void
  onCursor?: (line: number, col: number) => void
  onReady?: (api: EditorApi) => void
}

export function CodeEditor({ path, initial, fontSize, diagnostics, onChange, onRun, onSubmit, onCursor, onReady }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const handlers = useRef({ onChange, onRun, onSubmit, onCursor })
  handlers.current = { onChange, onRun, onSubmit, onCursor }

  useEffect(() => {
    setupMonaco()
    const ed = monaco.editor.create(host.current!, {
      theme: 'okiro-night',
      fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
      fontSize,
      lineHeight: Math.round(fontSize * 1.6),
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorSmoothCaretAnimation: 'on',
      cursorBlinking: 'smooth',
      cursorWidth: 2,
      padding: { top: 12, bottom: 12 },
      tabSize: 4,
      automaticLayout: true,
      bracketPairColorization: { enabled: false },
      guides: { bracketPairs: false, indentation: true, highlightActiveIndentation: true },
      matchBrackets: 'always',
      stickyScroll: { enabled: true },
      renderLineHighlight: 'line',
      lineNumbersMinChars: 3,
      glyphMargin: false,
      folding: true,
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
      quickSuggestions: { other: true, comments: false, strings: false },
      suggest: { showWords: false, preview: true },
      fixedOverflowWidgets: true
    })
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => handlers.current.onRun())
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => handlers.current.onSubmit())
    ed.onDidChangeCursorPosition((e) => handlers.current.onCursor?.(e.position.lineNumber, e.position.column))
    editor.current = ed
    onReady?.({
      insertSnippet: (body) => {
        const ctrl = ed.getContribution('snippetController2') as unknown as { insert: (t: string) => void } | null
        ed.focus()
        if (ctrl) ctrl.insert(body)
        else ed.trigger('okiro', 'type', { text: body })
      },
      setValue: (code) => {
        const m = ed.getModel()
        if (!m) return
        ed.pushUndoStop()
        ed.executeEdits('okiro', [{ range: m.getFullModelRange(), text: code }])
        ed.pushUndoStop()
      },
      revealLine: (line, col = 1) => {
        ed.revealLineInCenter(line)
        ed.setPosition({ lineNumber: line, column: col })
        ed.focus()
      },
      focus: () => ed.focus()
    })
    return () => {
      const m = ed.getModel()
      if (m) clangd.close(m)
      ed.dispose()
      m?.dispose()
      editor.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    editor.current?.updateOptions({ fontSize, lineHeight: Math.round(fontSize * 1.6) })
  }, [fontSize])

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

  // Compiler errors from the last run, as inline markers (clangd adds its own live ones).
  useEffect(() => {
    const m = editor.current?.getModel()
    if (!m) return
    monaco.editor.setModelMarkers(
      m,
      'compile',
      (diagnostics ?? []).map((d) => ({
        startLineNumber: d.line,
        startColumn: d.col,
        endLineNumber: d.line,
        endColumn: d.col + 1,
        message: d.message,
        severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : d.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info,
        source: 'compiler'
      }))
    )
  }, [diagnostics])

  return <div ref={host} className="h-full w-full" />
}
