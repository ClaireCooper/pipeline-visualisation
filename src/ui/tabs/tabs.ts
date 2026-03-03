import type { ParsedPipeline } from "../../core/parser";
import type { NavStack } from "../../core/navigation";

export interface Tab {
  id: number;
  name: string;
  yaml: string;
  pipeline: ParsedPipeline | null;
  navStack: NavStack | null;
}

export interface TabState {
  tabs: Tab[];
  activeId: number;
}

export function createTab(id: number, name: string, yaml = ""): Tab {
  return { id, name, yaml, pipeline: null, navStack: null };
}

export function addTab(state: TabState, tab: Tab): TabState {
  return { tabs: [...state.tabs, tab], activeId: tab.id };
}

export function removeTab(state: TabState, id: number): TabState | null {
  const remaining = state.tabs.filter((t) => t.id !== id);
  if (remaining.length === state.tabs.length) return state; // id not found
  if (remaining.length === 0) return null;
  let activeId = state.activeId;
  if (activeId === id) {
    const idx = state.tabs.findIndex((t) => t.id === id);
    activeId = idx > 0 ? state.tabs[idx - 1].id : state.tabs[idx + 1].id;
  }
  return { tabs: remaining, activeId };
}

export function setActive(state: TabState, id: number): TabState {
  return { ...state, activeId: id };
}

export function updateTab(
  state: TabState,
  id: number,
  patch: Partial<Omit<Tab, "id">>,
): TabState {
  return {
    ...state,
    tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  };
}

export function activeTab(state: TabState): Tab {
  const tab = state.tabs.find((t) => t.id === state.activeId);
  if (tab === undefined) throw new Error(`No tab with id ${state.activeId}`);
  return tab;
}
