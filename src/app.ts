import "./style.css";

import { cy } from "./ui/views/graph";
import { initEditor } from "./ui/editor/editor";
import { initViewController } from "./ui/views/viewController";
import { initTabController } from "./ui/tabs/tabController";
import { initEditorPane } from "./ui/editor/editorPane";

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
const tabBarEl = document.getElementById("tab-bar") as HTMLDivElement;
const zoomResetBtn = document.getElementById(
  "zoom-reset-btn",
) as HTMLButtonElement;

const vc = initViewController({
  cyEl,
  ganttEl,
  viewToggleBtn,
  backBtn,
  breadcrumbText,
  zoomResetBtn,
});

const tc = initTabController(tabBarEl, vc, initEditor);

vc.bindEvents(tc.getState, tc.drillDown, tc.back);

initEditorPane(editorPane, editorToggle, toggleBtn, () => {
  if (vc.getView() === "graph") {
    cy.resize();
    cy.fit(cy.elements(), 40);
  } else {
    vc.render(tc.getState(), tc.drillDown);
  }
});
