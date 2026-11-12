// Minimal LSP client for clangd (completion, hover, signature help, diagnostics) over the
// preload bridge. Only the pieces a single-file contest editor needs.
import * as monaco from 'monaco-editor'
import { api } from './api'

interface LspPosition {
  line: number
  character: number
}
interface LspRange {
  start: LspPosition
  end: LspPosition
}
interface LspCompletionItem {
  label: string
  kind?: number
  detail?: string
  documentation?: string | { value: string }
  sortText?: string
  filterText?: string
  insertText?: string
  insertTextFormat?: number
  textEdit?: { range: LspRange; newText: string }
}
interface LspDiagnostic {
  range: LspRange
  severity?: number
  message: string
  source?: string
}

const toMonacoRange = (r: LspRange) => new monaco.Range(r.start.line + 1, r.start.character + 1, r.end.line + 1, r.end.character + 1)
const toLspPos = (p: monaco.Position): LspPosition => ({ line: p.lineNumber - 1, character: p.column - 1 })

const KIND: Record<number, monaco.languages.CompletionItemKind> = {
  1: monaco.languages.CompletionItemKind.Text,
  2: monaco.languages.CompletionItemKind.Method,
  3: monaco.languages.CompletionItemKind.Function,
  4: monaco.languages.CompletionItemKind.Constructor,
  5: monaco.languages.CompletionItemKind.Field,
  6: monaco.languages.CompletionItemKind.Variable,
  7: monaco.languages.CompletionItemKind.Class,
  8: monaco.languages.CompletionItemKind.Interface,
  9: monaco.languages.CompletionItemKind.Module,
  10: monaco.languages.CompletionItemKind.Property,
  12: monaco.languages.CompletionItemKind.Value,
  13: monaco.languages.CompletionItemKind.Enum,
  14: monaco.languages.CompletionItemKind.Keyword,
  15: monaco.languages.CompletionItemKind.Snippet,
  20: monaco.languages.CompletionItemKind.EnumMember,
  21: monaco.languages.CompletionItemKind.Constant,
  22: monaco.languages.CompletionItemKind.Struct,
  25: monaco.languages.CompletionItemKind.TypeParameter
}

class ClangdClient {
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private versions = new Map<string, number>()
  private dirty = new Map<string, monaco.editor.ITextModel>()
  private timer: number | null = null
  private started: Promise<boolean> | null = null
  private registered = false

  constructor() {
    api.on('lsp:message', (raw) => this.onMessage(raw))
  }

  start(): Promise<boolean> {
    this.started ??= (async () => {
      const r = await api.lsp.start()
      if (!r) return false
      await this.request('initialize', {
        processId: null,
        rootUri: monaco.Uri.file(r.workDir).toString(),
        capabilities: {
          textDocument: {
            synchronization: { didSave: false },
            completion: { completionItem: { snippetSupport: true, documentationFormat: ['markdown', 'plaintext'] } },
            hover: { contentFormat: ['markdown', 'plaintext'] },
            signatureHelp: { signatureInformation: { documentationFormat: ['plaintext'] } },
            publishDiagnostics: {}
          }
        }
      })
      this.notify('initialized', {})
      this.registerProviders()
      return true
    })().catch(() => false)
    return this.started
  }

  private send(msg: object): void {
    api.lsp.send(JSON.stringify({ jsonrpc: '2.0', ...msg }))
  }

  request<T>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.send({ id, method, params })
      window.setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`${method} timed out`))
      }, 15000)
    })
  }

  notify(method: string, params: unknown): void {
    this.send({ method, params })
  }

  private onMessage(raw: string): void {
    const msg = JSON.parse(raw) as { id?: number; method?: string; params?: unknown; result?: unknown; error?: { message: string } }
    if (msg.id !== undefined && !msg.method) {
      const p = this.pending.get(msg.id)
      if (!p) return
      this.pending.delete(msg.id)
      if (msg.error) p.reject(new Error(msg.error.message))
      else p.resolve(msg.result)
      return
    }
    if (msg.method === 'textDocument/publishDiagnostics') {
      const { uri, diagnostics } = msg.params as { uri: string; diagnostics: LspDiagnostic[] }
      const model = monaco.editor.getModel(monaco.Uri.parse(uri))
      if (!model) return
      monaco.editor.setModelMarkers(
        model,
        'clangd',
        diagnostics.map((d) => ({
          ...rangeToMarker(d.range),
          message: d.message,
          severity:
            d.severity === 1
              ? monaco.MarkerSeverity.Error
              : d.severity === 2
                ? monaco.MarkerSeverity.Warning
                : d.severity === 3
                  ? monaco.MarkerSeverity.Info
                  : monaco.MarkerSeverity.Hint,
          source: 'clangd'
        }))
      )
    } else if (msg.id !== undefined && msg.method) {
      // Server-to-client requests (e.g. workDoneProgress/create): acknowledge them.
      this.send({ id: msg.id, result: null })
    }
  }

  open(model: monaco.editor.ITextModel): void {
    const uri = model.uri.toString()
    this.versions.set(uri, 1)
    this.notify('textDocument/didOpen', { textDocument: { uri, languageId: 'cpp', version: 1, text: model.getValue() } })
  }

  close(model: monaco.editor.ITextModel): void {
    const uri = model.uri.toString()
    if (!this.versions.has(uri)) return
    this.flush()
    this.versions.delete(uri)
    this.notify('textDocument/didClose', { textDocument: { uri } })
  }

  changed(model: monaco.editor.ITextModel): void {
    this.dirty.set(model.uri.toString(), model)
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => this.flush(), 250)
  }

  private flush(): void {
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = null
    for (const [uri, model] of this.dirty) {
      const version = (this.versions.get(uri) ?? 0) + 1
      if (!this.versions.has(uri)) continue
      this.versions.set(uri, version)
      this.notify('textDocument/didChange', { textDocument: { uri, version }, contentChanges: [{ text: model.getValue() }] })
    }
    this.dirty.clear()
  }

  private tracked(model: monaco.editor.ITextModel): boolean {
    return this.versions.has(model.uri.toString())
  }

  private registerProviders(): void {
    if (this.registered) return
    this.registered = true
    monaco.languages.registerCompletionItemProvider('cpp', {
      triggerCharacters: ['.', '>', ':', '<', '"', '/'],
      provideCompletionItems: async (model, position) => {
        if (!this.tracked(model)) return { suggestions: [] }
        this.flush()
        const res = await this.request<{ items: LspCompletionItem[] } | LspCompletionItem[] | null>('textDocument/completion', {
          textDocument: { uri: model.uri.toString() },
          position: toLspPos(position)
        }).catch(() => null)
        const items = Array.isArray(res) ? res : (res?.items ?? [])
        const word = model.getWordUntilPosition(position)
        const fallback = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
        return {
          suggestions: items.slice(0, 200).map((it) => ({
            label: it.label.replace(/^[\s•]+/, ''),
            kind: KIND[it.kind ?? 1] ?? monaco.languages.CompletionItemKind.Text,
            detail: it.detail,
            documentation: typeof it.documentation === 'string' ? it.documentation : it.documentation?.value,
            sortText: it.sortText,
            filterText: it.filterText,
            insertText: it.textEdit?.newText ?? it.insertText ?? it.label.trim(),
            insertTextRules: it.insertTextFormat === 2 ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
            range: it.textEdit ? toMonacoRange(it.textEdit.range) : fallback
          }))
        }
      }
    })
    monaco.languages.registerHoverProvider('cpp', {
      provideHover: async (model, position) => {
        if (!this.tracked(model)) return null
        this.flush()
        const res = await this.request<{ contents: { value: string } | string; range?: LspRange } | null>('textDocument/hover', {
          textDocument: { uri: model.uri.toString() },
          position: toLspPos(position)
        }).catch(() => null)
        if (!res) return null
        const value = typeof res.contents === 'string' ? res.contents : res.contents.value
        return { contents: [{ value }], range: res.range ? toMonacoRange(res.range) : undefined }
      }
    })
    monaco.languages.registerSignatureHelpProvider('cpp', {
      signatureHelpTriggerCharacters: ['(', ','],
      provideSignatureHelp: async (model, position) => {
        if (!this.tracked(model)) return null
        this.flush()
        const res = await this.request<monaco.languages.SignatureHelp | null>('textDocument/signatureHelp', {
          textDocument: { uri: model.uri.toString() },
          position: toLspPos(position)
        }).catch(() => null)
        if (!res || !res.signatures?.length) return null
        return { value: res, dispose: () => undefined }
      }
    })
  }
}

function rangeToMarker(r: LspRange) {
  return {
    startLineNumber: r.start.line + 1,
    startColumn: r.start.character + 1,
    endLineNumber: r.end.line + 1,
    endColumn: r.end.character + 1
  }
}

export const clangd = new ClangdClient()
