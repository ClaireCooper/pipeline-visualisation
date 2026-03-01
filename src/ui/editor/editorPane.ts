export function initEditorPane(
  editorPane: HTMLDivElement,
  editorToggle: HTMLDivElement,
  toggleBtn: HTMLButtonElement,
  onResize: () => void,
): void {
  toggleBtn.addEventListener("click", () => {
    const collapsed = editorPane.classList.toggle("collapsed");
    toggleBtn.textContent = collapsed ? "›" : "‹";
    editorPane.addEventListener("transitionend", onResize, { once: true });
  });

  let isDragging = false;
  let didDrag = false;
  let dragStartX = 0;
  let dragStartWidth = 0;

  function stopDrag(): void {
    isDragging = false;
    editorPane.style.transition = "";
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    if (didDrag) onResize();
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
}
