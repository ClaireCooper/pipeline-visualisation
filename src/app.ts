import "./style.css";

import { cy, renderWorkflow, initTooltip } from "./graph";
import { initEditor } from "./editor";
import { createNavStack, push, pop, current } from "./navigation";
import type { ParsedPipeline } from "./parser";
import { renderGantt, initGantt } from "./gantt";
import { hasMissingDurations } from "./scheduler";
import { showTooltip, hideTooltip } from "./tooltip";
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

// DOM elements
const backBtn = document.getElementById("back-btn") as HTMLButtonElement;
const breadcrumbText = document.getElementById(
  "breadcrumb-text",
) as HTMLSpanElement;
const editorPane = document.getElementById("editor-pane") as HTMLDivElement;
const editorToggle = document.getElementById("editor-toggle") as HTMLDivElement;
const toggleBtn = document.getElementById("toggle-btn") as HTMLButtonElement;
const viewToggleBtn = document.getElementById(
  "view-toggle-btn",
) as HTMLButtonElement;
const cyEl = document.getElementById("cy") as HTMLDivElement;
const ganttEl = document.getElementById("gantt") as HTMLDivElement;
const tabBar = document.getElementById("tab-bar") as HTMLDivElement;

// State
let tabState: TabState = createTabState();
let view: "graph" | "gantt" = "graph";

// ── Tab bar rendering ──────────────────────────────────────────────────────

function renderTabs(): void {
  tabBar.innerHTML = "";

  for (const tab of tabState.tabs) {
    const tabBtn = document.createElement("button");
    tabBtn.className =
      "tab" + (tab.id === tabState.activeId ? " tab-active" : "");

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = tab.name;
    label.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      startRename(tab.id, label);
    });

    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-close";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      saveCurrentTab();
      tabState = removeTab(tabState, tab.id);
      renderTabs();
      loadActiveTab();
    });

    tabBtn.append(label, closeBtn);
    tabBtn.addEventListener("click", () => {
      if (tab.id === tabState.activeId) return;
      saveCurrentTab();
      tabState = setActive(tabState, tab.id);
      renderTabs();
      loadActiveTab();
    });

    tabBar.appendChild(tabBtn);
  }

  const addBtn = document.createElement("button");
  addBtn.className = "tab-add";
  addBtn.textContent = "+";
  addBtn.addEventListener("click", () => {
    saveCurrentTab();
    const n = tabState.tabs.length + 1;
    const tab = createTab(`pipeline-${n}`);
    tabState = addTab(tabState, tab);
    renderTabs();
    loadActiveTab();
  });
  tabBar.appendChild(addBtn);
}

function startRename(id: string, label: HTMLSpanElement): void {
  const input = document.createElement("input");
  input.className = "tab-rename";
  input.value = label.textContent ?? "";
  label.replaceWith(input);
  input.focus();
  input.select();

  function commit(): void {
    const name = input.value.trim() || (label.textContent ?? "untitled");
    tabState = updateTab(tabState, id, { name });
    setTimeout(renderTabs, 0);
  }

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      input.removeEventListener("blur", commit);
      renderTabs();
    }
  });
}

// ── Tab switching helpers ──────────────────────────────────────────────────

function saveCurrentTab(): void {
  tabState = updateTab(tabState, tabState.activeId, { yaml: getContent() });
}

function loadActiveTab(): void {
  const tab = activeTab(tabState);
  setContent(tab.yaml);

  if (tab.pipeline) {
    render();
  } else {
    ganttEl.style.display = "none";
    cyEl.style.display = "";
    cy.elements().remove();
    view = "graph";
    viewToggleBtn.setAttribute("aria-checked", "false");
    viewToggleBtn.setAttribute("aria-disabled", "true");
  }

  updateBreadcrumb();
  clearError();
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────

function updateBreadcrumb(): void {
  const tab = activeTab(tabState);
  if (!tab.navStack) {
    breadcrumbText.textContent = "";
    backBtn.style.display = "none";
    return;
  }
  breadcrumbText.textContent = tab.navStack.items.join(" › ");
  backBtn.style.display =
    tab.navStack.items.length > 1 ? "inline-block" : "none";
}

// ── Drill-down ─────────────────────────────────────────────────────────────

function drillDown(uses: string): void {
  const tab = activeTab(tabState);
  if (!tab.pipeline || !tab.navStack || !(uses in tab.pipeline.workflows))
    return;
  tabState = updateTab(tabState, tabState.activeId, {
    navStack: push(tab.navStack, uses),
  });
  render();
  updateBreadcrumb();
}

// ── View toggle state ──────────────────────────────────────────────────────

function updateToggleState(): void {
  const tab = activeTab(tabState);
  if (!tab.pipeline || !tab.navStack) return;
  const wf = tab.pipeline.workflows[current(tab.navStack)];
  if (!wf) return;
  const missing = hasMissingDurations(wf, tab.pipeline);
  if (missing) {
    viewToggleBtn.setAttribute("aria-disabled", "true");
    viewToggleBtn.setAttribute(
      "aria-label",
      "Toggle view (all jobs must have a duration)",
    );
  } else {
    viewToggleBtn.removeAttribute("aria-disabled");
    viewToggleBtn.setAttribute("aria-label", "Toggle view");
  }
  if (missing && view === "gantt") {
    view = "graph";
    viewToggleBtn.setAttribute("aria-checked", "false");
  }
}

// ── Render ─────────────────────────────────────────────────────────────────

function render(): void {
  const tab = activeTab(tabState);
  if (!tab.pipeline || !tab.navStack) return;
  updateToggleState();
  const wf = current(tab.navStack);
  if (view === "graph") {
    ganttEl.style.display = "none";
    cyEl.style.display = "";
    renderWorkflow(wf, tab.pipeline);
  } else {
    cyEl.style.display = "none";
    ganttEl.style.display = "block";
    renderGantt(wf, tab.pipeline, drillDown);
  }
}

// ── onParsed callback ──────────────────────────────────────────────────────

function onParsed(newPipeline: ParsedPipeline): void {
  const tab = activeTab(tabState);
  const firstWorkflow = Object.keys(newPipeline.workflows)[0];
  if (!firstWorkflow) return;

  // Preserve existing navStack if it still points to a valid workflow
  let navStack = tab.navStack;
  if (!navStack || !(current(navStack) in newPipeline.workflows)) {
    navStack = createNavStack(firstWorkflow);
  }

  tabState = updateTab(tabState, tabState.activeId, {
    pipeline: newPipeline,
    navStack,
  });
  render();
  updateBreadcrumb();
  clearError();
}

// ── File upload creates a new tab ──────────────────────────────────────────

function onFileLoaded(filename: string, text: string): void {
  saveCurrentTab();
  const name = filename.replace(/\.(yaml|yml)$/, "");
  const tab = createTab(name, text);
  tabState = addTab(tabState, tab);
  renderTabs();
  loadActiveTab();
}

// ── Init ───────────────────────────────────────────────────────────────────

const { clearError, setContent, getContent } = initEditor(
  onParsed,
  onFileLoaded,
);
initTooltip();
initGantt();
renderTabs();

// ── Graph interactions ─────────────────────────────────────────────────────

// Click a node with `uses` to drill into that workflow
cy.on("tap", "node[uses]", (evt) => {
  drillDown(evt.target.data("uses") as string);
});

// Editor toggle
toggleBtn.addEventListener("click", () => {
  const collapsed = editorPane.classList.toggle("collapsed");
  toggleBtn.textContent = collapsed ? "›" : "‹";
  editorPane.addEventListener(
    "transitionend",
    () => {
      if (view === "graph") {
        cy.resize();
        cy.fit(cy.elements(), 40);
      } else {
        render();
      }
    },
    { once: true },
  );
});

// Editor resize drag
let isDragging = false;
let didDrag = false;
let dragStartX = 0;
let dragStartWidth = 0;

function stopDrag(): void {
  isDragging = false;
  editorPane.style.transition = "";
  document.body.style.userSelect = "";
  document.body.style.cursor = "";
  if (didDrag) {
    if (view === "graph") {
      cy.resize();
      cy.fit(cy.elements(), 40);
    } else {
      render();
    }
  }
}

editorToggle.addEventListener("mousedown", (e) => {
  isDragging = true;
  didDrag = false;
  dragStartX = e.clientX;
  dragStartWidth = editorPane.offsetWidth;
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";
});

document.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  if (e.buttons === 0) {
    stopDrag();
    return;
  }
  const delta = e.clientX - dragStartX;
  if (Math.abs(delta) > 4) {
    if (!didDrag) editorPane.style.transition = "none";
    didDrag = true;
  }
  if (!didDrag) return;

  const isCollapsed = editorPane.classList.contains("collapsed");
  if (isCollapsed) {
    if (delta <= 0) return;
    editorPane.classList.remove("collapsed");
    toggleBtn.textContent = "‹";
    dragStartX = e.clientX;
    dragStartWidth = 100;
  }

  const newWidth = Math.max(
    100,
    Math.min(dragStartWidth + delta, window.innerWidth * 0.75),
  );
  editorPane.style.width = `${newWidth}px`;
});

document.addEventListener("mouseup", () => {
  if (!isDragging) return;
  stopDrag();
});

// View toggle (Graph ↔ Gantt)
viewToggleBtn.addEventListener("click", () => {
  if (viewToggleBtn.getAttribute("aria-disabled") === "true") return;
  view = view === "graph" ? "gantt" : "graph";
  viewToggleBtn.setAttribute(
    "aria-checked",
    view === "gantt" ? "true" : "false",
  );
  render();
});

// Toggle tooltip when disabled
viewToggleBtn.addEventListener("mouseenter", (e) => {
  if (viewToggleBtn.getAttribute("aria-disabled") === "true") {
    showTooltip(
      "All jobs must have a duration to view a Gantt chart",
      e.clientX,
      e.clientY,
    );
  }
});
viewToggleBtn.addEventListener("mouseleave", () => hideTooltip());

// Back button
backBtn.addEventListener("click", () => {
  const tab = activeTab(tabState);
  if (!tab.navStack || !tab.pipeline) return;
  tabState = updateTab(tabState, tabState.activeId, {
    navStack: pop(tab.navStack),
  });
  render();
  updateBreadcrumb();
});
