export function initHelpModal(
  helpBtn: HTMLButtonElement,
  modal: HTMLElement,
): void {
  const closeBtn = modal.querySelector<HTMLButtonElement>(".modal-close");
  if (!closeBtn)
    throw new Error("initHelpModal: modal must contain a .modal-close button");

  function open(): void {
    modal.classList.remove("hidden");
  }

  function close(): void {
    modal.classList.add("hidden");
  }

  helpBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}
