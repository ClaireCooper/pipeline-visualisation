import type { Workflow, ParsedPipeline } from "./parser";

// --- Types ---

export interface ScheduledJob {
  id: string;
  start: number;
  end: number;
  uses?: string;
}

// --- Scheduling ---

export function criticalPathDuration(
  workflowName: string,
  pipeline: ParsedPipeline,
): number {
  const workflow = pipeline.workflows[workflowName];
  if (!workflow) return 0;
  return scheduledJobs(workflow, pipeline).reduce(
    (max, j) => Math.max(max, j.end),
    0,
  );
}

export function scheduledJobs(
  workflow: Workflow,
  pipeline: ParsedPipeline,
): ScheduledJob[] {
  const { nodes, edges } = workflow;

  // Build adjacency maps for Kahn's topological sort.
  // Edge direction: source → target means "source is a prerequisite of target".
  const prereqs = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const nodeById = new Map<string, (typeof nodes)[number]>();

  for (const node of nodes) {
    prereqs.set(node.id, []);
    successors.set(node.id, []);
    inDegree.set(node.id, 0);
    nodeById.set(node.id, node);
  }
  for (const edge of edges) {
    const targetPrereqs = prereqs.get(edge.target) ?? [];
    targetPrereqs.push(edge.source);
    prereqs.set(edge.target, targetPrereqs);

    const sourceSuccessors = successors.get(edge.source) ?? [];
    sourceSuccessors.push(edge.target);
    successors.set(edge.source, sourceSuccessors);

    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // BFS from zero-in-degree nodes
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const finishTime = new Map<string, number>();
  const result: ScheduledJob[] = [];

  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;

    const node = nodeById.get(id);
    if (node === undefined) continue;

    const duration =
      node.duration !== undefined
        ? node.duration
        : criticalPathDuration(node.uses ?? "", pipeline);

    const preds = prereqs.get(id) ?? [];
    const start =
      preds.length === 0
        ? 0
        : Math.max(...preds.map((p) => finishTime.get(p) ?? 0));
    const end = start + duration;
    finishTime.set(id, end);

    result.push({
      id,
      start,
      end,
      ...(node.uses !== undefined ? { uses: node.uses } : {}),
    });

    for (const succ of successors.get(id) ?? []) {
      inDegree.set(succ, (inDegree.get(succ) ?? 0) - 1);
      if (inDegree.get(succ) === 0) queue.push(succ);
    }
  }

  return result;
}
