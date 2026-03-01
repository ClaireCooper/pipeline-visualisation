import { EditorView, basicSetup } from "codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";

import { parse } from "./parser";
import type { ParsedPipeline } from "./parser";

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
      oneDark,
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
