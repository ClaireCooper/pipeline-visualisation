function getTooltipEl(): HTMLDivElement | null {
  return document.getElementById("cy-tooltip") as HTMLDivElement | null;
}

export function showTooltip(
  text: string,
  clientX: number,
  clientY: number,
): void {
  const el = getTooltipEl();
  if (!el) return;
  el.textContent = text;
  el.style.display = "block";
  const tipW = el.offsetWidth;
  const left =
    clientX + 12 + tipW > window.innerWidth
      ? clientX - tipW - 12
      : clientX + 12;
  el.style.left = `${left}px`;
  el.style.top = `${clientY - 8}px`;
}

export function hideTooltip(): void {
  getTooltipEl()?.style.setProperty("display", "none");
}
