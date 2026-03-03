import { describe, it, expect } from "vitest";
import type { TabState } from "./tabs";
import {
  createTab,
  addTab,
  removeTab,
  setActive,
  updateTab,
  activeTab,
} from "./tabs";

function tab(id: number, name = "x"): ReturnType<typeof createTab> {
  return createTab(id, name);
}

function state(...tabs: ReturnType<typeof createTab>[]): TabState {
  return { tabs, activeId: tabs[0].id };
}

describe("addTab", () => {
  it("appends the tab and makes it active", () => {
    const s0 = state(tab(1, "first"));
    const t2 = tab(2, "second");
    const s1 = addTab(s0, t2);
    expect(s1.tabs).toHaveLength(2);
    expect(s1.activeId).toBe(2);
  });
});

describe("removeTab", () => {
  it("removes a non-active tab without changing activeId", () => {
    const t1 = tab(1);
    const t2 = tab(2);
    const s0 = { tabs: [t1, t2], activeId: 2 };
    const s1 = removeTab(s0, 1);
    expect(s1?.tabs).toHaveLength(1);
    expect(s1?.tabs[0].id).toBe(2);
    expect(s1?.activeId).toBe(2);
  });

  it("removes the active tab and activates the nearest neighbour", () => {
    const t1 = tab(1);
    const t2 = tab(2);
    const s0 = { tabs: [t1, t2], activeId: 2 };
    const s1 = removeTab(s0, 2);
    expect(s1?.tabs).toHaveLength(1);
    expect(s1?.activeId).toBe(1);
  });

  it("returns null when removing the last tab", () => {
    const s0 = state(tab(1));
    expect(removeTab(s0, 1)).toBeNull();
  });

  it("removes the active middle tab and activates the left neighbour", () => {
    const t1 = tab(1);
    const t2 = tab(2);
    const t3 = tab(3);
    const s0 = { tabs: [t1, t2, t3], activeId: 2 };
    const s1 = removeTab(s0, 2);
    expect(s1?.tabs).toHaveLength(2);
    expect(s1?.activeId).toBe(1);
  });

  it("removes the first (active) tab and activates the right neighbour", () => {
    const t1 = tab(1);
    const t2 = tab(2);
    const s0 = { tabs: [t1, t2], activeId: 1 };
    const s1 = removeTab(s0, 1);
    expect(s1?.tabs).toHaveLength(1);
    expect(s1?.activeId).toBe(2);
  });
});

describe("updateTab", () => {
  it("patches a tab by id, leaving others unchanged", () => {
    const s0 = state(tab(1));
    const s1 = updateTab(s0, 1, { name: "renamed" });
    expect(activeTab(s1).name).toBe("renamed");
    expect(activeTab(s1).yaml).toBe("");
  });
});

describe("setActive", () => {
  it("changes the active id", () => {
    const t1 = tab(1);
    const t2 = tab(2);
    const s0 = { tabs: [t1, t2], activeId: 2 };
    const s1 = setActive(s0, 1);
    expect(s1.activeId).toBe(1);
  });
});

describe("activeTab", () => {
  it("throws when activeId does not match any tab", () => {
    const s = { tabs: [], activeId: 99 } as unknown as TabState;
    expect(() => activeTab(s)).toThrow("No tab with id 99");
  });
});
