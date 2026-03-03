import type { TabState } from "./tabs";

export interface TabBarCallbacks {
  onSwitch: (id: number) => void;
  onClose: (id: number) => void;
  onAdd: () => void;
  onRename: (id: number, name: string) => void;
  onRerender: () => void;
}

export function renderTabBar(
  container: HTMLDivElement,
  state: TabState,
  callbacks: TabBarCallbacks,
): void {
  container.innerHTML = "";

  for (const tab of state.tabs) {
    const tabBtn = document.createElement("button");
    tabBtn.className = "tab" + (tab.id === state.activeId ? " tab-active" : "");

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = tab.name;
    label.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      startRename(tab.id, label, callbacks.onRename, callbacks.onRerender);
    });

    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-close";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onClose(tab.id);
    });

    tabBtn.append(label, closeBtn);
    tabBtn.addEventListener("click", () => {
      if (tab.id === state.activeId) return;
      callbacks.onSwitch(tab.id);
    });

    container.appendChild(tabBtn);
  }

  const addBtn = document.createElement("button");
  addBtn.className = "tab-add";
  addBtn.textContent = "+";
  addBtn.addEventListener("click", () => {
    callbacks.onAdd();
  });
  container.appendChild(addBtn);
}

function startRename(
  id: number,
  label: HTMLSpanElement,
  onRename: (id: number, name: string) => void,
  onRerender: () => void,
): void {
  const input = document.createElement("input");
  input.className = "tab-rename";
  input.value = label.textContent ?? "";
  label.replaceWith(input);
  input.focus();
  input.select();

  function commit(): void {
    const name = input.value.trim() || (label.textContent ?? "untitled");
    onRename(id, name);
  }

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      input.removeEventListener("blur", commit);
      onRerender();
    }
  });
}
