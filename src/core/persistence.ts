import type { TabState, Tab } from "../ui/tabs/tabs";

const STORAGE_KEY = "pipeline-visualisation:tabs";

interface PersistedTab {
  id: number;
  name: string;
  yaml: string;
}

interface PersistedState {
  tabs: PersistedTab[];
  activeId: number;
}

function validate(data: unknown): data is PersistedState {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.tabs) || typeof d.activeId !== "number") return false;
  if (
    !d.tabs.every(
      (t) =>
        t &&
        typeof t === "object" &&
        typeof (t as Record<string, unknown>).id === "number" &&
        typeof (t as Record<string, unknown>).name === "string" &&
        typeof (t as Record<string, unknown>).yaml === "string",
    )
  )
    return false;
  const ids = new Set((d.tabs as Record<string, unknown>[]).map((t) => t.id));
  return ids.has(d.activeId);
}

export function saveState(state: TabState): void {
  try {
    const persisted: PersistedState = {
      tabs: state.tabs.map(({ id, name, yaml }) => ({ id, name, yaml })),
      activeId: state.activeId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // localStorage unavailable or quota exceeded — fail silently
  }
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    return validate(data) ? data : null;
  } catch {
    return null;
  }
}

export function restoreTabState(persisted: PersistedState): TabState {
  const tabs: Tab[] = persisted.tabs.map(({ id, name, yaml }) => ({
    id,
    name,
    yaml,
    pipeline: null,
    navStack: null,
  }));
  return { tabs, activeId: persisted.activeId };
}
