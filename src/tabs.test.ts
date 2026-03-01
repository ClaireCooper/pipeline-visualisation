import { describe, it, expect } from "vitest";
import {
  createTabState,
  createTab,
  addTab,
  removeTab,
  setActive,
  updateTab,
  activeTab,
} from "./tabs";

describe("createTabState", () => {
  it("starts with one blank tab as the active tab", () => {
    const state = createTabState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].yaml).toBe("");
    expect(state.tabs[0].pipeline).toBeNull();
    expect(state.activeId).toBe(state.tabs[0].id);
  });
});

describe("addTab", () => {
  it("appends the tab and makes it active", () => {
    const state = createTabState();
    const tab = createTab("new");
    const next = addTab(state, tab);
    expect(next.tabs).toHaveLength(2);
    expect(next.activeId).toBe(tab.id);
  });
});

describe("removeTab", () => {
  it("removes a non-active tab without changing activeId", () => {
    const s0 = createTabState();
    const tab2 = createTab("two");
    const s1 = addTab(s0, tab2); // active = tab2
    const firstId = s0.tabs[0].id;
    const s2 = removeTab(s1, firstId);
    expect(s2.tabs).toHaveLength(1);
    expect(s2.tabs[0].id).toBe(tab2.id);
    expect(s2.activeId).toBe(tab2.id);
  });

  it("removes the active tab and activates the nearest neighbour", () => {
    const s0 = createTabState();
    const tab2 = createTab("two");
    const s1 = addTab(s0, tab2); // active = tab2
    const s2 = removeTab(s1, tab2.id);
    expect(s2.tabs).toHaveLength(1);
    expect(s2.activeId).toBe(s0.tabs[0].id);
  });

  it("replaces the last tab with a fresh blank state", () => {
    const state = createTabState();
    const onlyId = state.tabs[0].id;
    const next = removeTab(state, onlyId);
    expect(next.tabs).toHaveLength(1);
    expect(next.tabs[0].yaml).toBe("");
    expect(next.tabs[0].id).not.toBe(onlyId);
  });
});

describe("updateTab", () => {
  it("patches a tab by id, leaving others unchanged", () => {
    const s0 = createTabState();
    const id = s0.activeId;
    const s1 = updateTab(s0, id, { name: "renamed" });
    expect(activeTab(s1).name).toBe("renamed");
    expect(activeTab(s1).yaml).toBe("");
  });
});

describe("setActive", () => {
  it("changes the active id", () => {
    const s0 = createTabState();
    const tab2 = createTab("two");
    const s1 = addTab(s0, tab2);
    const s2 = setActive(s1, s0.tabs[0].id);
    expect(s2.activeId).toBe(s0.tabs[0].id);
  });
});

describe("activeTab", () => {
  it("throws when activeId does not match any tab", () => {
    const state = { tabs: [], activeId: "ghost" } as unknown as TabState;
    expect(() => activeTab(state)).toThrow("No tab with id ghost");
  });
});
