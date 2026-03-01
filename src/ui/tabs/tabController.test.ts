import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTabController } from "./tabController";
import type { ParsedPipeline } from "../../core/parser";

function makeVc() {
  return {
    render: vi.fn(),
    resetView: vi.fn(),
    updateBreadcrumb: vi.fn(),
  };
}

function makeEditor(initialContent = "") {
  let content = initialContent;
  return {
    getContent: () => content,
    setContent: (yaml: string) => {
      content = yaml;
    },
    clearError: vi.fn(),
  };
}

function makeEditorFactory(initialContent = "") {
  return () => makeEditor(initialContent);
}

function makeContainer() {
  return document.createElement("div") as HTMLDivElement;
}

const PIPELINE: ParsedPipeline = {
  workflows: { build: { nodes: [{ id: "lint" }], edges: [] } },
};

const PIPELINE_TWO_WORKFLOWS: ParsedPipeline = {
  workflows: {
    build: { nodes: [{ id: "lint" }], edges: [] },
    deploy: { nodes: [{ id: "ship" }], edges: [] },
  },
};

describe("initTabController", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
  });

  it("starts with a single blank tab", () => {
    const tc = initTabController(container, makeVc(), makeEditorFactory());
    const { tabs, activeId } = tc.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe(activeId);
    expect(tabs[0].pipeline).toBeNull();
  });

  describe("addNewTab", () => {
    it("adds a second tab and makes it active", () => {
      const tc = initTabController(container, makeVc(), makeEditorFactory());
      tc.addNewTab();
      const { tabs, activeId } = tc.getState();
      expect(tabs).toHaveLength(2);
      expect(activeId).toBe(tabs[1].id);
    });
  });

  describe("closeTab", () => {
    it("removes the tab from state", () => {
      const tc = initTabController(container, makeVc(), makeEditorFactory());
      tc.addNewTab();
      const idToClose = tc.getState().activeId;
      tc.closeTab(idToClose);
      expect(tc.getState().tabs.map((t) => t.id)).not.toContain(idToClose);
    });

    it("replaces the last tab with a fresh one when closing it", () => {
      const tc = initTabController(container, makeVc(), makeEditorFactory());
      const onlyId = tc.getState().activeId;
      tc.closeTab(onlyId);
      const { tabs } = tc.getState();
      expect(tabs).toHaveLength(1);
      expect(tabs[0].id).not.toBe(onlyId);
    });
  });

  describe("switchTab", () => {
    it("sets the active tab", () => {
      const tc = initTabController(
        container,
        makeVc(),
        makeEditorFactory("tab1 content"),
      );
      tc.addNewTab();
      const firstId = tc.getState().tabs[0].id;
      tc.switchTab(firstId);
      expect(tc.getState().activeId).toBe(firstId);
    });

    it("saves current editor content before switching", () => {
      const editor = makeEditor("original");
      const tc = initTabController(container, makeVc(), () => editor);
      tc.addNewTab();

      // Now on tab2; simulate user typing
      editor.setContent("edited on tab2");
      const firstId = tc.getState().tabs[0].id;
      tc.switchTab(firstId);

      // Switch back to tab2 — its saved yaml should reflect the edit
      const tab2Id = tc.getState().tabs[1].id;
      tc.switchTab(tab2Id);
      expect(editor.getContent()).toBe("edited on tab2");
    });
  });

  describe("renameTab", () => {
    it("updates the tab name", () => {
      const tc = initTabController(container, makeVc(), makeEditorFactory());
      const id = tc.getState().activeId;
      tc.renameTab(id, "my-pipeline");
      expect(tc.getState().tabs[0].name).toBe("my-pipeline");
    });
  });

  describe("onParsed", () => {
    it("stores pipeline on active tab and calls vc.render", () => {
      const vc = makeVc();
      const tc = initTabController(container, vc, makeEditorFactory());
      tc.onParsed(PIPELINE);
      expect(tc.getState().tabs[0].pipeline).toBe(PIPELINE);
      expect(vc.render).toHaveBeenCalled();
    });

    it("initialises navStack to first workflow", () => {
      const tc = initTabController(container, makeVc(), makeEditorFactory());
      tc.onParsed(PIPELINE);
      expect(tc.getState().tabs[0].navStack?.items).toEqual(["build"]);
    });

    it("preserves navStack when the current workflow still exists", () => {
      const tc = initTabController(container, makeVc(), makeEditorFactory());
      tc.onParsed(PIPELINE_TWO_WORKFLOWS);
      tc.drillDown("deploy");
      tc.onParsed(PIPELINE_TWO_WORKFLOWS);
      expect(tc.getState().tabs[0].navStack?.items).toEqual([
        "build",
        "deploy",
      ]);
    });

    it("resets navStack when the current workflow disappears", () => {
      const tc = initTabController(container, makeVc(), makeEditorFactory());
      tc.onParsed(PIPELINE_TWO_WORKFLOWS);
      tc.drillDown("deploy");
      // Re-parse with a pipeline that no longer has "deploy"
      tc.onParsed(PIPELINE);
      expect(tc.getState().tabs[0].navStack?.items).toEqual(["build"]);
    });
  });

  describe("onFileLoaded", () => {
    it("replaces the active tab when it is empty", () => {
      const tc = initTabController(container, makeVc(), makeEditorFactory());
      tc.onFileLoaded("ci.yaml", "jobs:\n  build: {}");
      const { tabs, activeId } = tc.getState();
      expect(tabs).toHaveLength(1);
      const active = tabs.find((t) => t.id === activeId);
      expect(active?.name).toBe("ci");
      expect(active?.yaml).toBe("jobs:\n  build: {}");
    });

    it("creates a new tab when the active tab has content", () => {
      const tc = initTabController(
        container,
        makeVc(),
        makeEditorFactory("existing: content"),
      );
      tc.onFileLoaded("ci.yaml", "jobs:\n  build: {}");
      const { tabs, activeId } = tc.getState();
      expect(tabs).toHaveLength(2);
      const newTab = tabs.find((t) => t.id === activeId);
      expect(newTab?.name).toBe("ci");
    });
  });

  describe("drillDown", () => {
    it("pushes the workflow onto the navStack and calls vc.render", () => {
      const vc = makeVc();
      const tc = initTabController(container, vc, makeEditorFactory());
      tc.onParsed(PIPELINE_TWO_WORKFLOWS);
      vc.render.mockClear();

      tc.drillDown("deploy");

      expect(tc.getState().tabs[0].navStack?.items).toEqual([
        "build",
        "deploy",
      ]);
      expect(vc.render).toHaveBeenCalled();
    });

    it("does nothing if the workflow does not exist", () => {
      const vc = makeVc();
      const tc = initTabController(container, vc, makeEditorFactory());
      tc.onParsed(PIPELINE);
      vc.render.mockClear();

      tc.drillDown("nonexistent");

      expect(tc.getState().tabs[0].navStack?.items).toEqual(["build"]);
      expect(vc.render).not.toHaveBeenCalled();
    });
  });

  describe("back", () => {
    it("pops the navStack and calls vc.render", () => {
      const vc = makeVc();
      const tc = initTabController(container, vc, makeEditorFactory());
      tc.onParsed(PIPELINE_TWO_WORKFLOWS);
      tc.drillDown("deploy");
      vc.render.mockClear();

      tc.back();

      expect(tc.getState().tabs[0].navStack?.items).toEqual(["build"]);
      expect(vc.render).toHaveBeenCalled();
    });

    it("does nothing when already at the root", () => {
      const vc = makeVc();
      const tc = initTabController(container, vc, makeEditorFactory());
      // no pipeline → back should no-op
      vc.render.mockClear();
      tc.back();
      expect(vc.render).not.toHaveBeenCalled();
    });
  });
});
