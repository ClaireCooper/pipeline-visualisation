import { renderTabBar } from "./tabBar";
import {
  createTab,
  addTab,
  removeTab,
  setActive,
  updateTab,
  activeTab,
} from "./tabs";
import type { TabState } from "./tabs";
import { createNavStack, push, pop, current } from "../../core/navigation";
import type { ParsedPipeline } from "../../core/parser";
import { saveState, loadState, restoreTabState } from "../../core/persistence";
import EXAMPLE_YAML from "./example.yaml?raw";
export { EXAMPLE_YAML };

interface EditorAPI {
  getContent: () => string;
  setContent: (yaml: string) => void;
  clearError: () => void;
}

type EditorFactory = (
  onParsed: (pipeline: ParsedPipeline) => void,
  onFileLoaded: (filename: string, text: string) => void,
) => EditorAPI;

interface ViewAPI {
  render: (state: TabState, onDrillDown: (uses: string) => void) => void;
  resetView: () => void;
  updateBreadcrumb: (state: TabState) => void;
}

export function initTabController(
  tabBarEl: HTMLDivElement,
  vc: ViewAPI,
  createEditor: EditorFactory,
) {
  let _nextId = 1;
  function nextId(): number {
    return _nextId++;
  }
  function freshState(): TabState {
    const tab = createTab(nextId(), "pipeline-1", EXAMPLE_YAML);
    return { tabs: [tab], activeId: tab.id };
  }

  const persisted = loadState();
  let state = persisted ? restoreTabState(persisted) : freshState();
  if (persisted && state.tabs.length > 0)
    _nextId = Math.max(...state.tabs.map((t) => t.id)) + 1;

  const editor = createEditor(onParsed, onFileLoaded);

  function persist(): void {
    saveState(state);
  }

  function rerenderTabs(): void {
    renderTabBar(tabBarEl, state, {
      onSwitch: switchTab,
      onClose: closeTab,
      onAdd: addNewTab,
      onRename: renameTab,
      onRerender: rerenderTabs,
    });
  }

  function saveCurrentTab(): void {
    state = updateTab(state, state.activeId, { yaml: editor.getContent() });
  }

  function loadActiveTab(): void {
    const tab = activeTab(state);
    editor.setContent(tab.yaml);
    if (tab.pipeline) {
      vc.render(state, drillDown);
    } else {
      vc.resetView();
    }
    vc.updateBreadcrumb(state);
    editor.clearError();
  }

  function switchTab(id: number): void {
    saveCurrentTab();
    state = setActive(state, id);
    persist();
    rerenderTabs();
    loadActiveTab();
  }

  function closeTab(id: number): void {
    saveCurrentTab();
    state = removeTab(state, id) ?? freshState();
    persist();
    rerenderTabs();
    loadActiveTab();
  }

  function addNewTab(): void {
    saveCurrentTab();
    const n = state.tabs.length + 1;
    const tab = createTab(nextId(), `pipeline-${n}`);
    state = addTab(state, tab);
    persist();
    rerenderTabs();
    loadActiveTab();
  }

  function renameTab(id: number, name: string): void {
    state = updateTab(state, id, { name });
    persist();
    setTimeout(rerenderTabs, 0);
  }

  function drillDown(uses: string): void {
    const tab = activeTab(state);
    if (!tab.pipeline || !tab.navStack || !(uses in tab.pipeline.workflows))
      return;
    state = updateTab(state, state.activeId, {
      navStack: push(tab.navStack, uses),
    });
    vc.render(state, drillDown);
    vc.updateBreadcrumb(state);
  }

  function onParsed(newPipeline: ParsedPipeline): void {
    const tab = activeTab(state);
    const firstWorkflow = Object.keys(newPipeline.workflows)[0];
    if (!firstWorkflow) return;

    let navStack = tab.navStack;
    if (!navStack || !(current(navStack) in newPipeline.workflows)) {
      navStack = createNavStack(firstWorkflow);
    }

    state = updateTab(state, state.activeId, {
      pipeline: newPipeline,
      navStack,
      yaml: editor.getContent(),
    });
    persist();
    vc.render(state, drillDown);
    vc.updateBreadcrumb(state);
    editor.clearError();
  }

  function onFileLoaded(filename: string, text: string): void {
    saveCurrentTab();
    const name = filename.replace(/\.(yaml|yml)$/, "");
    const active = activeTab(state);
    if (active.yaml === "" || active.yaml === EXAMPLE_YAML) {
      state = updateTab(state, state.activeId, { name, yaml: text });
    } else {
      const tab = createTab(nextId(), name, text);
      state = addTab(state, tab);
    }
    persist();
    rerenderTabs();
    loadActiveTab();
  }

  function back(): void {
    const tab = activeTab(state);
    if (!tab.navStack || !tab.pipeline) return;
    state = updateTab(state, state.activeId, {
      navStack: pop(tab.navStack),
    });
    vc.render(state, drillDown);
    vc.updateBreadcrumb(state);
  }

  function downloadActive(): void {
    const name = activeTab(state).name;
    const yaml = editor.getContent();
    const filename = `${name}.yaml`;
    const blob = new Blob([yaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getState(): TabState {
    return state;
  }

  document
    .getElementById("save-btn")
    ?.addEventListener("click", downloadActive);

  rerenderTabs();
  loadActiveTab();

  return {
    getState,
    onParsed,
    onFileLoaded,
    drillDown,
    back,
    downloadActive,
    switchTab,
    closeTab,
    addNewTab,
    renameTab,
  };
}
