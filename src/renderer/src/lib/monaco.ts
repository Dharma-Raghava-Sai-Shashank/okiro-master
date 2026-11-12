import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import snippets from '../../../../resources/snippets/cpp.json'

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment
  }
}

let ready = false

export function setupMonaco(): typeof monaco {
  if (ready) return monaco
  ready = true
  window.MonacoEnvironment = { getWorker: () => new EditorWorker() }

  monaco.editor.defineTheme('okiro-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'a78bfa' },
      { token: 'keyword.directive', foreground: 'f472b6' },
      { token: 'string', foreground: '86efac' },
      { token: 'number', foreground: 'fbbf24' },
      { token: 'type', foreground: '67e8f9' },
      { token: 'identifier', foreground: 'dbe4f3' },
      { token: 'delimiter', foreground: '94a3b8' }
    ],
    colors: {
      'editor.background': '#080d18',
      'editor.foreground': '#dbe4f3',
      'editorLineNumber.foreground': '#334155',
      'editorLineNumber.activeForeground': '#93c5fd',
      'editor.lineHighlightBackground': '#0f172a',
      'editor.selectionBackground': '#1d4ed866',
      'editorCursor.foreground': '#60a5fa',
      'editorIndentGuide.background1': '#1e293b',
      'editorWidget.background': '#0d1322',
      'editorSuggestWidget.background': '#0d1322',
      'editorSuggestWidget.border': '#1e293b',
      'editorSuggestWidget.selectedBackground': '#1d4ed844',
      'editorHoverWidget.background': '#0d1322',
      'editorHoverWidget.border': '#1e293b',
      'scrollbarSlider.background': '#94a3b822'
    }
  })

  // Contest snippets ("cp", "dsu", "segtree", …) alongside clangd's completions.
  const entries = Object.values(snippets as Record<string, { prefix: string; description: string; body: string[] }>)
  monaco.languages.registerCompletionItemProvider('cpp', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
      return {
        suggestions: entries.map((s) => ({
          label: s.prefix,
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: s.description,
          documentation: { value: '```cpp\n' + s.body.join('\n') + '\n```' },
          insertText: s.body.join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          sortText: '0' + s.prefix,
          range
        }))
      }
    }
  })
  return monaco
}

export { monaco }
