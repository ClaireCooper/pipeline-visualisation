import { renderTabBar } from "./tabBar";
import {
  createTabState,
  createTab,
  addTab,
  removeTab,
  setActive,
  updateTab,
  activeTab,
} from "./tabs";
import type { TabState } from "./tabs";
import { createNavStack, push, pop, current } from "./navigation";
import type { ParsedPipeline } from "./parser";

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
  let state = createTabState();
  const editor = createEditor(onParsed, onFileLoaded);

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

  function switchTab(id: string): void {
    saveCurrentTab();
    state = setActive(state, id);
    rerenderTabs();
    loadActiveTab();
  }

  function closeTab(id: string): void {
    saveCurrentTab();
    state = removeTab(state, id);
    rerenderTabs();
    loadActiveTab();
  }

  function addNewTab(): void {
    saveCurrentTab();
    const n = state.tabs.length + 1;
    const tab = createTab(`pipeline-${n}`);
    state = addTab(state, tab);
    rerenderTabs();
    loadActiveTab();
  }

  function renameTab(id: string, name: string): void {
    state = updateTab(state, id, { name });
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
    });
    vc.render(state, drillDown);
    vc.updateBreadcrumb(state);
    editor.clearError();
  }

  function onFileLoaded(filename: string, text: string): void {
    saveCurrentTab();
    const name = filename.replace(/\.(yaml|yml)$/, "");
    const tab = createTab(name, text);
    state = addTab(state, tab);
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

  function getState(): TabState {
    return state;
  }

  rerenderTabs();

  return {
    getState,
    onParsed,
    onFileLoaded,
    drillDown,
    back,
    // Exposed for tab bar callbacks (also useful for testing)
    switchTab,
    closeTab,
    addNewTab,
    renameTab,
  };
}
