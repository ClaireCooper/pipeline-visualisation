import { describe, it, expect } from "vitest";
import { createNavStack, push, pop, current } from "./navigation";

describe("navigation stack", () => {
  it("initialises with a single workflow", () => {
    const stack = createNavStack("main");
    expect(current(stack)).toBe("main");
  });

  it("push adds a workflow to the stack", () => {
    const stack = createNavStack("main");
    const next = push(stack, "deploy");
    expect(current(next)).toBe("deploy");
  });

  it("pop returns to the previous workflow", () => {
    const stack = createNavStack("main");
    const next = push(stack, "deploy");
    const back = pop(next);
    expect(current(back)).toBe("main");
  });

  it("pop on a single-item stack is a no-op", () => {
    const stack = createNavStack("main");
    const same = pop(stack);
    expect(current(same)).toBe("main");
  });

  it("breadcrumb returns all workflow names in order", () => {
    const stack = createNavStack("main");
    const next = push(push(stack, "deploy"), "inner");
    expect(next.items).toEqual(["main", "deploy", "inner"]);
  });

  it("stack is immutable — push does not modify original", () => {
    const stack = createNavStack("main");
    push(stack, "deploy");
    expect(current(stack)).toBe("main");
  });
});
