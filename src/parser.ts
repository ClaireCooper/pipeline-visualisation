import * as yaml from "js-yaml";

export interface JobNode {
  id: string;
  duration?: number;
  uses?: string;
}

export interface Edge {
  source: string;
  target: string;
}

export interface Workflow {
  nodes: JobNode[];
  edges: Edge[];
}

export interface ParsedPipeline {
  workflows: Record<string, Workflow>;
}

export type ParseResult =
  | { ok: true; pipeline: ParsedPipeline }
  | { ok: false; error: string };

export function parse(yamlText: string): ParseResult {
  let doc: unknown;
  try {
    doc = yaml.load(yamlText);
  } catch (e) {
    return { ok: false, error: `Invalid YAML: ${(e as Error).message}` };
  }

  if (!doc || typeof doc !== "object") {
    return { ok: false, error: "Expected a YAML object at the top level" };
  }

  const root = doc as Record<string, unknown>;
  if (!root["workflows"] || typeof root["workflows"] !== "object") {
    return { ok: false, error: 'Missing "workflows" key' };
  }

  const rawWorkflows = root["workflows"] as Record<string, unknown>;
  const workflows: Record<string, Workflow> = {};

  for (const [workflowName, rawWorkflow] of Object.entries(rawWorkflows)) {
    const wf = rawWorkflow as Record<string, unknown>;
    const rawJobs = wf["jobs"] as Record<string, unknown> | undefined;
    if (!rawJobs) {
      workflows[workflowName] = { nodes: [], edges: [] };
      continue;
    }

    const nodes: JobNode[] = [];
    const edges: Edge[] = [];

    for (const [jobName, rawJob] of Object.entries(rawJobs)) {
      const job = (rawJob ?? {}) as Record<string, unknown>;
      const node: JobNode = { id: jobName };
      if (typeof job["duration"] === "number") node.duration = job["duration"];
      if (typeof job["uses"] === "string") node.uses = job["uses"];

      const needs = job["needs"];
      if (Array.isArray(needs)) {
        for (const dep of needs) {
          if (typeof dep === "string") {
            edges.push({ source: dep, target: jobName });
          }
        }
      }

      nodes.push(node);
    }

    workflows[workflowName] = { nodes, edges };
  }

  // Validate all uses references
  for (const [workflowName, workflow] of Object.entries(workflows)) {
    for (const node of workflow.nodes) {
      if (node.uses !== undefined && !(node.uses in workflows)) {
        return {
          ok: false,
          error: `Job "${node.id}" in workflow "${workflowName}" references unknown workflow "${node.uses}"`,
        };
      }
    }
  }

  return { ok: true, pipeline: { workflows } };
}
