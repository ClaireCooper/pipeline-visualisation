import { cy, renderWorkflow, initTooltip } from "./graph";
import { renderGantt, initGantt, resetGanttZoom } from "./gantt";
import { hasMissingDurations } from "../../core/scheduler";
import { current } from "../../core/navigation";
import { activeTab } from "../tabs/tabs";
import type { TabState } from "../tabs/tabs";
import { showTooltip, hideTooltip } from "../tooltip";

interface ViewElements {
  cyEl: HTMLDivElement;
  ganttEl: HTMLDivElement;
  viewToggleBtn: HTMLButtonElement;
  backBtn: HTMLButtonElement;
  breadcrumbText: HTMLSpanElement;
  zoomResetBtn: HTMLButtonElement;
}

export function initViewController(elements: ViewElements) {
  initGantt();
  let view: "graph" | "gantt" = "graph";

  function updateToggleState(tabState: TabState): void {
    const tab = activeTab(tabState);
    if (!tab.pipeline || !tab.navStack) return;
    const wf = tab.pipeline.workflows[current(tab.navStack)];
    if (!wf) return;
    const missing = hasMissingDurations(wf, tab.pipeline);
    if (missing) {
      elements.viewToggleBtn.setAttribute("aria-disabled", "true");
      elements.viewToggleBtn.setAttribute(
        "aria-label",
        "Toggle view (all jobs must have a duration)",
      );
    } else {
      elements.viewToggleBtn.removeAttribute("aria-disabled");
      elements.viewToggleBtn.setAttribute("aria-label", "Toggle view");
    }
    if (missing && view === "gantt") {
      view = "graph";
      elements.viewToggleBtn.setAttribute("aria-checked", "false");
    }
  }

  function render(
    tabState: TabState,
    onDrillDown: (uses: string) => void,
  ): void {
    const tab = activeTab(tabState);
    if (!tab.pipeline || !tab.navStack) return;
    updateToggleState(tabState);
    const wf = current(tab.navStack);
    if (view === "graph") {
      elements.ganttEl.style.display = "none";
      elements.cyEl.style.display = "";
      renderWorkflow(wf, tab.pipeline);
    } else {
      elements.cyEl.style.display = "none";
      elements.ganttEl.style.display = "block";
      renderGantt(wf, tab.pipeline, onDrillDown);
    }
  }

  function updateBreadcrumb(tabState: TabState): void {
    const tab = activeTab(tabState);
    if (!tab.navStack) {
      elements.breadcrumbText.textContent = "";
      elements.backBtn.style.display = "none";
      return;
    }
    elements.breadcrumbText.textContent = tab.navStack.items.join(" › ");
    elements.backBtn.style.display =
      tab.navStack.items.length > 1 ? "inline-block" : "none";
  }

  function resetView(): void {
    view = "graph";
    elements.ganttEl.style.display = "none";
    elements.cyEl.style.display = "";
    cy.elements().remove();
    elements.viewToggleBtn.setAttribute("aria-checked", "false");
    elements.viewToggleBtn.setAttribute("aria-disabled", "true");
  }

  function getView(): "graph" | "gantt" {
    return view;
  }

  function toggleView(): boolean {
    if (elements.viewToggleBtn.getAttribute("aria-disabled") === "true")
      return false;
    view = view === "graph" ? "gantt" : "graph";
    elements.viewToggleBtn.setAttribute(
      "aria-checked",
      view === "gantt" ? "true" : "false",
    );
    return true;
  }

  function bindEvents(
    getState: () => TabState,
    onDrillDown: (uses: string) => void,
    onBack: () => void,
  ): void {
    initTooltip();
    cy.on("tap", "node[uses]", (evt) => {
      onDrillDown(evt.target.data("uses") as string);
    });
    elements.backBtn.addEventListener("click", onBack);
    elements.viewToggleBtn.addEventListener("click", () => {
      if (toggleView()) render(getState(), onDrillDown);
    });
    elements.viewToggleBtn.addEventListener("mouseenter", (e) => {
      if (elements.viewToggleBtn.getAttribute("aria-disabled") === "true") {
        showTooltip(
          "All jobs must have a duration to view a Gantt chart",
          e.clientX,
          e.clientY,
        );
      }
    });
    elements.viewToggleBtn.addEventListener("mouseleave", () => hideTooltip());
    elements.zoomResetBtn.addEventListener("click", () => {
      if (view === "graph") {
        cy.fit(cy.elements(), 40);
      } else {
        resetGanttZoom();
      }
    });
  }

  return { render, updateBreadcrumb, resetView, getView, bindEvents };
}
