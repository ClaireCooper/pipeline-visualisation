import { describe, it, expect, beforeEach } from "vitest";
import { initHelpModal } from "./helpModal";

function getHelpBtn(): HTMLButtonElement {
  const el = document.getElementById("help-btn");
  if (!el) throw new Error("no #help-btn element");
  return el as HTMLButtonElement;
}

function getModal(): HTMLElement {
  const el = document.getElementById("help-modal");
  if (!el) throw new Error("no #help-modal element");
  return el;
}

function getCloseBtn(): HTMLButtonElement {
  const el = document.querySelector(".modal-close");
  if (!el) throw new Error("no .modal-close element");
  return el as HTMLButtonElement;
}

function getModalCard(): HTMLElement {
  const el = document.querySelector(".modal-card");
  if (!el) throw new Error("no .modal-card element");
  return el as HTMLElement;
}

beforeEach(() => {
  document.body.innerHTML = `
    <button id="help-btn"></button>
    <div id="help-modal" class="modal-backdrop hidden">
      <div class="modal-card">
        <button class="modal-close">×</button>
      </div>
    </div>
  `;
});

describe("initHelpModal", () => {
  it("modal is hidden on init", () => {
    initHelpModal(getHelpBtn(), getModal());
    expect(getModal().classList.contains("hidden")).toBe(true);
  });

  it("opens when help button is clicked", () => {
    initHelpModal(getHelpBtn(), getModal());
    getHelpBtn().click();
    expect(getModal().classList.contains("hidden")).toBe(false);
  });

  it("closes when close button is clicked", () => {
    initHelpModal(getHelpBtn(), getModal());
    getHelpBtn().click();
    getCloseBtn().click();
    expect(getModal().classList.contains("hidden")).toBe(true);
  });

  it("closes when backdrop is clicked", () => {
    initHelpModal(getHelpBtn(), getModal());
    getHelpBtn().click();
    getModal().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(getModal().classList.contains("hidden")).toBe(true);
  });

  it("does not close when card content is clicked", () => {
    initHelpModal(getHelpBtn(), getModal());
    getHelpBtn().click();
    getModalCard().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(getModal().classList.contains("hidden")).toBe(false);
  });

  it("closes on Escape key", () => {
    initHelpModal(getHelpBtn(), getModal());
    getHelpBtn().click();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(getModal().classList.contains("hidden")).toBe(true);
  });
});
