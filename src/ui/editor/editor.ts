import { EditorView, basicSetup } from "codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

import { parse } from "../../core/parser";
import type { ParsedPipeline } from "../../core/parser";

const appTheme = EditorView.theme({
  "&": {
    background: "#252526",
    color: "#d4d4d4",
  },
  ".cm-content": {
    caretColor: "#d4d4d4",
  },
  ".cm-cursor": {
    borderLeftColor: "#d4d4d4",
  },
  ".cm-gutters": {
    background: "#252526",
    color: "#858585",
    border: "none",
    borderRight: "1px solid #3c3c3c",
  },
  ".cm-activeLineGutter": {
    background: "#2a2d2e",
  },
  ".cm-activeLine": {
    background: "#2a2d2e",
  },
  ".cm-selectionBackground, ::selection": {
    background: "#264f78 !important",
  },
  ".cm-focused .cm-selectionBackground": {
    background: "#264f78",
  },
  ".cm-matchingBracket": {
    background: "#3c3c3c",
    outline: "1px solid #858585",
  },
});

const appHighlightStyle = HighlightStyle.define([
  { tag: tags.lineComment, color: "#858585", fontStyle: "italic" },
  { tag: tags.keyword, color: "#858585" },
  { tag: tags.string, color: "#f9ab55" },
  { tag: tags.content, color: "#47cbbc" },
  { tag: tags.propertyName, color: "#c586c0" },
  { tag: tags.attributeName, color: "#c586c0" },
  { tag: tags.typeName, color: "#c586c0" },
  { tag: tags.separator, color: "#d4d4d4" },
  { tag: tags.punctuation, color: "#d4d4d4" },
  { tag: tags.squareBracket, color: "#d4d4d4" },
  { tag: tags.brace, color: "#d4d4d4" },
]);

const errorMsg = document.getElementById("error-msg") as HTMLDivElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;

export function initEditor(
  onParsed: (p: ParsedPipeline) => void,
  onFileLoaded: (filename: string, text: string) => void = () => {
    /* no-op */
  },
): {
  clearError: () => void;
  setContent: (text: string) => void;
  getContent: () => string;
} {
  let debounceTimer: ReturnType<typeof setTimeout>;

  const editor = new EditorView({
    extensions: [
      basicSetup,
      yaml(),
      appTheme,
      syntaxHighlighting(appHighlightStyle),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const text = editor.state.doc.toString();
          if (!text.trim()) {
            clearError();
            return;
          }
          const result = parse(text);
          if (result.ok) {
            onParsed(result.pipeline);
          } else {
            errorMsg.textContent = result.error;
          }
        }, 300);
      }),
    ],
    parent: document.getElementById("yaml-input") as HTMLElement,
  });

  // File upload — notify app.ts so it can create a new tab
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== "string") return;
      // Reset so the same file can be uploaded again
      fileInput.value = "";
      onFileLoaded(file.name, text);
    };
    reader.readAsText(file);
  });

  function clearError(): void {
    errorMsg.textContent = "";
  }

  function setContent(text: string): void {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: text },
    });
  }

  function getContent(): string {
    return editor.state.doc.toString();
  }

  return { clearError, setContent, getContent };
}
