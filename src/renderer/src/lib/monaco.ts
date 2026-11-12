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

  // "okiro-night": calm, high-legibility palette tuned to the app's blues. No rainbow brackets.
  monaco.editor.defineTheme('okiro-night', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'd6deeb' },
      { token: 'comment', foreground: '56657d', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c4b5fd' },
      { token: 'keyword.directive', foreground: 'f0abfc' },
      { token: 'keyword.directive.include', foreground: 'f0abfc' },
      { token: 'string', foreground: '86efac' },
      { token: 'string.include', foreground: '86efac' },
      { token: 'number', foreground: 'fdba74' },
      { token: 'type', foreground: '7dd3fc' },
      { token: 'identifier', foreground: 'd6deeb' },
      { token: 'delimiter', foreground: '8b9ab3' },
      { token: 'operator', foreground: '94a3b8' },
      { token: 'annotation', foreground: 'f0abfc' }
    ],
    colors: {
      'editor.background': '#0a1020',
      'editor.foreground': '#d6deeb',
      'editorLineNumber.foreground': '#2c3a54',
      'editorLineNumber.activeForeground': '#7dd3fc',
      'editor.lineHighlightBackground': '#0f172a80',
      'editor.lineHighlightBorder': '#00000000',
      'editor.selectionBackground': '#1e40af66',
      'editor.inactiveSelectionBackground': '#1e3a8a40',
      'editor.wordHighlightBackground': '#38bdf81a',
      'editorCursor.foreground': '#22d3ee',
      'editorBracketMatch.background': '#22d3ee14',
      'editorBracketMatch.border': '#22d3ee66',
      'editorIndentGuide.background1': '#16213a',
      'editorIndentGuide.activeBackground1': '#24375c',
      'editorWhitespace.foreground': '#1b2740',
      'editorGutter.background': '#0a1020',
      'editorWidget.background': '#0d1424',
      'editorWidget.border': '#1e293b',
      'editorSuggestWidget.background': '#0d1424',
      'editorSuggestWidget.border': '#1e293b',
      'editorSuggestWidget.selectedBackground': '#1e3a8a66',
      'editorSuggestWidget.highlightForeground': '#67e8f9',
      'editorHoverWidget.background': '#0d1424',
      'editorHoverWidget.border': '#1e293b',
      'editorError.foreground': '#fb7185',
      'editorWarning.foreground': '#fbbf24',
      'editorStickyScroll.background': '#0b1324',
      'editorStickyScrollHover.background': '#111c33',
      'scrollbarSlider.background': '#94a3b81f',
      'scrollbarSlider.hoverBackground': '#94a3b833',
      'scrollbar.shadow': '#00000000'
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
