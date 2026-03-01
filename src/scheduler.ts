import type { JobNode, Edge, Workflow, ParsedPipeline } from "./parser";

export interface ScheduledJob {
  id: string;
  start: number;
  end: number;
  uses?: string;
}

export function criticalPathDuration(
  workflowName: string,
  pipeline: ParsedPipeline,
): number {
  const workflow = pipeline.workflows[workflowName];
  if (!workflow) return 0;
  return calculateScheduledJobs(workflow, pipeline).reduce(
    (max, j) => Math.max(max, j.end),
    0,
  );
}

interface Graph {
  prereqs: Map<string, string[]>;
  successors: Map<string, string[]>;
  inDegree: Map<string, number>;
  nodeById: Map<string, JobNode>;
}

// Build adjacency maps for Kahn's topological sort.
// Edge direction: source → target means "source is a prerequisite of target".
function buildGraph(nodes: JobNode[], edges: Edge[]): Graph {
  const prereqs = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const nodeById = new Map<string, JobNode>();

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

  return { prereqs, successors, inDegree, nodeById };
}

function calculateDuration(node: JobNode, pipeline: ParsedPipeline): number {
  return node.duration !== undefined
    ? node.duration
    : criticalPathDuration(node.uses ?? "", pipeline);
}

function startTime(
  id: string,
  prereqs: Map<string, string[]>,
  finishTime: Map<string, number>,
): number {
  const preds = prereqs.get(id) ?? [];
  return preds.length === 0
    ? 0
    : Math.max(...preds.map((p) => finishTime.get(p) ?? 0));
}

function enqueueReady(
  id: string,
  successors: Map<string, string[]>,
  inDegree: Map<string, number>,
  queue: string[],
): void {
  for (const succ of successors.get(id) ?? []) {
    inDegree.set(succ, (inDegree.get(succ) ?? 0) - 1);
    if (inDegree.get(succ) === 0) queue.push(succ);
  }
}

function makeInitialQueue(inDegree: Map<string, number>): string[] {
  return [...inDegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([id]) => id);
}

function runBFS(graph: Graph, pipeline: ParsedPipeline): ScheduledJob[] {
  const { prereqs, successors, inDegree, nodeById } = graph;
  const queue = makeInitialQueue(inDegree);
  const finishTime = new Map<string, number>();
  const result: ScheduledJob[] = [];

  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;
    const node = nodeById.get(id);
    if (node === undefined) continue;

    const duration = calculateDuration(node, pipeline);
    const start = startTime(id, prereqs, finishTime);
    const end = start + duration;
    finishTime.set(id, end);

    result.push({
      id,
      start,
      end,
      ...(node.uses !== undefined ? { uses: node.uses } : {}),
    });
    enqueueReady(id, successors, inDegree, queue);
  }
  return result;
}

export function calculateScheduledJobs(
  workflow: Workflow,
  pipeline: ParsedPipeline,
): ScheduledJob[] {
  return runBFS(buildGraph(workflow.nodes, workflow.edges), pipeline);
}
