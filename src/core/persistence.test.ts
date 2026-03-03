import { describe, it, expect, beforeEach } from "vitest";
import { saveState, loadState, restoreTabState } from "./persistence";
import type { TabState } from "../ui/tabs/tabs";

function makeState(): TabState {
  return {
    tabs: [
      {
        id: 3,
        name: "ci",
        yaml: "jobs:\n  build: {}",
        pipeline: null,
        navStack: null,
      },
      {
        id: 7,
        name: "deploy",
        yaml: "jobs:\n  ship: {}",
        pipeline: null,
        navStack: null,
      },
    ],
    activeId: 7,
  };
}

describe("loadState", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nothing is stored", () => {
    expect(loadState()).toBeNull();
  });

  it("returns null when stored value is invalid JSON", () => {
    localStorage.setItem("pipeline-visualisation:tabs", "not-json");
    expect(loadState()).toBeNull();
  });

  it("returns null when stored value has wrong shape", () => {
    localStorage.setItem(
      "pipeline-visualisation:tabs",
      JSON.stringify({ wrong: true }),
    );
    expect(loadState()).toBeNull();
  });

  it("returns null when a tab entry is missing a field", () => {
    const bad = { tabs: [{ id: 1, name: "x" }], activeId: 1 };
    localStorage.setItem("pipeline-visualisation:tabs", JSON.stringify(bad));
    expect(loadState()).toBeNull();
  });

  it("returns null when activeId does not match any tab id", () => {
    const bad = { tabs: [{ id: 1, name: "x", yaml: "" }], activeId: 99 };
    localStorage.setItem("pipeline-visualisation:tabs", JSON.stringify(bad));
    expect(loadState()).toBeNull();
  });
});

describe("saveState / loadState round-trip", () => {
  beforeEach(() => localStorage.clear());

  it("restores tab ids, names, and yaml", () => {
    const state = makeState();
    saveState(state);
    const loaded = loadState();
    if (loaded === null)
      throw new Error("expected loadState to return a value");
    expect(loaded.tabs).toHaveLength(2);
    expect(loaded.tabs[0]).toEqual({
      id: 3,
      name: "ci",
      yaml: "jobs:\n  build: {}",
    });
    expect(loaded.tabs[1]).toEqual({
      id: 7,
      name: "deploy",
      yaml: "jobs:\n  ship: {}",
    });
    expect(loaded.activeId).toBe(7);
  });

  it("overwrites previous save", () => {
    saveState(makeState());
    const state2: TabState = {
      tabs: [
        { id: 1, name: "only", yaml: "x: 1", pipeline: null, navStack: null },
      ],
      activeId: 1,
    };
    saveState(state2);
    const loaded = loadState();
    if (loaded === null)
      throw new Error("expected loadState to return a value");
    expect(loaded.tabs).toHaveLength(1);
    expect(loaded.tabs[0].name).toBe("only");
  });
});

describe("restoreTabState", () => {
  it("sets pipeline and navStack to null on every tab", () => {
    const persisted = {
      tabs: [
        { id: 3, name: "ci", yaml: "jobs: {}" },
        { id: 7, name: "deploy", yaml: "jobs: {}" },
      ],
      activeId: 3,
    };
    const state = restoreTabState(persisted);
    expect(state.tabs).toHaveLength(2);
    for (const tab of state.tabs) {
      expect(tab.pipeline).toBeNull();
      expect(tab.navStack).toBeNull();
    }
    expect(state.activeId).toBe(3);
  });
});
