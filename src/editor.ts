import { EditorView, basicSetup } from "codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";

import { parse } from "./parser";
import type { ParsedPipeline } from "./parser";

const errorMsg = document.getElementById("error-msg") as HTMLDivElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;

export function initEditor(onParsed: (p: ParsedPipeline) => void): {
  clearError: () => void;
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
          const result = parse(editor.state.doc.toString());
          if (result.ok) {
            onParsed(result.pipeline);
          } else {
            errorMsg.textContent = result.error;
          }
        }, 300);
      }),
    ],
    parent: document.getElementById("yaml-input")!,
  });

  // File upload — load into editor, parse fires via updateListener
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== "string") return;
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: text },
      });
    };
    reader.readAsText(file);
  });

  function clearError(): void {
    errorMsg.textContent = "";
  }

  return { clearError };
}
