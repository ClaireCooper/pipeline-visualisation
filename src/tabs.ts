import type { ParsedPipeline } from "./parser";
import type { NavStack } from "./navigation";

export interface Tab {
  id: string;
  name: string;
  yaml: string;
  pipeline: ParsedPipeline | null;
  navStack: NavStack | null;
}

export interface TabState {
  tabs: Tab[];
  activeId: string;
}

let _nextId = 1;

export function createTab(name: string, yaml = ""): Tab {
  return { id: `tab-${_nextId++}`, name, yaml, pipeline: null, navStack: null };
}

export function createTabState(): TabState {
  const tab = createTab("pipeline-1");
  return { tabs: [tab], activeId: tab.id };
}

export function addTab(state: TabState, tab: Tab): TabState {
  return { tabs: [...state.tabs, tab], activeId: tab.id };
}

export function removeTab(state: TabState, id: string): TabState {
  const remaining = state.tabs.filter((t) => t.id !== id);
  if (remaining.length === 0) return createTabState();
  let activeId = state.activeId;
  if (activeId === id) {
    const idx = state.tabs.findIndex((t) => t.id === id);
    activeId = idx > 0 ? state.tabs[idx - 1].id : state.tabs[idx + 1].id;
  }
  return { tabs: remaining, activeId };
}

export function setActive(state: TabState, id: string): TabState {
  return { ...state, activeId: id };
}

export function updateTab(
  state: TabState,
  id: string,
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
