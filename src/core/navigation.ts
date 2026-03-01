export interface NavStack {
  items: string[];
}

export function createNavStack(initial: string): NavStack {
  return { items: [initial] };
}

export function push(stack: NavStack, workflow: string): NavStack {
  return { items: [...stack.items, workflow] };
}

export function pop(stack: NavStack): NavStack {
  if (stack.items.length <= 1) return stack;
  return { items: stack.items.slice(0, -1) };
}

export function current(stack: NavStack): string {
  return stack.items[stack.items.length - 1];
}
