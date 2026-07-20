import { ApiError, assertExactKeys, isPlainObject } from "./hardening";
import type { StackGraph, StackGraphEdge, StackGraphNode } from "../graph";

const IDENTIFIER = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const DISALLOWED_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function validateChatPayload(payload: Record<string, unknown>) {
  assertExactKeys(payload, ["prompt"], "Chat request");
  if (typeof payload.prompt !== "string") {
    throw new ApiError(400, "invalid_prompt", "Prompt must be a string.");
  }
  const prompt = payload.prompt.trim();
  if (prompt.length < 3 || prompt.length > 2_000 || DISALLOWED_CONTROL_CHARACTERS.test(prompt)) {
    throw new ApiError(400, "invalid_prompt", "Prompt must contain 3 to 2,000 valid characters.");
  }
  return prompt;
}

export function extractOpenRouterGraph(payload: unknown): StackGraph {
  if (!isPlainObject(payload) || !Array.isArray(payload.choices) || payload.choices.length < 1) {
    throw new ApiError(502, "invalid_upstream_response", "The provider returned an invalid response.");
  }
  const choice = payload.choices[0];
  if (!isPlainObject(choice) || !isPlainObject(choice.message) || typeof choice.message.content !== "string") {
    throw new ApiError(502, "invalid_upstream_response", "The provider returned an invalid response.");
  }

  const content = stripJsonFence(choice.message.content.trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ApiError(502, "invalid_architecture", "The provider did not return a valid architecture graph.");
  }
  return validateStackGraph(parsed);
}

export function validateStackGraph(value: unknown): StackGraph {
  if (!isPlainObject(value)) throw invalidGraph();
  assertGraphKeys(value, ["nodes", "edges"]);
  if (!Array.isArray(value.nodes) || value.nodes.length < 4 || value.nodes.length > 8) throw invalidGraph();
  if (!Array.isArray(value.edges) || value.edges.length < 1 || value.edges.length > 16) throw invalidGraph();

  const nodes = value.nodes.map(validateNode);
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) throw invalidGraph();

  const edges = value.edges.map((edge) => validateEdge(edge, nodeIds));
  const edgeIds = new Set(edges.map((edge) => edge.id));
  if (edgeIds.size !== edges.length) throw invalidGraph();
  return { nodes, edges };
}

function validateNode(value: unknown): StackGraphNode {
  if (!isPlainObject(value)) throw invalidGraph();
  assertGraphKeys(value, ["id", "type", "data"]);
  if (typeof value.id !== "string" || !IDENTIFIER.test(value.id) || value.type !== "tool" || !isPlainObject(value.data)) {
    throw invalidGraph();
  }
  assertGraphKeys(value.data, ["label", "category", "description"]);
  const label = boundedText(value.data.label, 1, 80);
  const category = boundedText(value.data.category, 1, 60);
  const description = boundedText(value.data.description, 1, 240);
  return { id: value.id, type: "tool", data: { label, category, description } };
}

function validateEdge(value: unknown, nodeIds: Set<string>): StackGraphEdge {
  if (!isPlainObject(value)) throw invalidGraph();
  assertGraphKeys(value, ["id", "source", "target", "label"]);
  if (
    typeof value.id !== "string" || !IDENTIFIER.test(value.id)
    || typeof value.source !== "string" || !nodeIds.has(value.source)
    || typeof value.target !== "string" || !nodeIds.has(value.target)
    || value.source === value.target
  ) {
    throw invalidGraph();
  }
  return {
    id: value.id,
    source: value.source,
    target: value.target,
    label: boundedText(value.label, 1, 80),
  };
}

function boundedText(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== "string") throw invalidGraph();
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < minimum || normalized.length > maximum || DISALLOWED_CONTROL_CHARACTERS.test(normalized)) {
    throw invalidGraph();
  }
  return normalized;
}

function assertGraphKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const keys = Object.keys(value);
  if (keys.length !== allowed.length || keys.some((key) => !allowed.includes(key))) throw invalidGraph();
}

function stripJsonFence(content: string) {
  const fenced = content.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? content;
}

function invalidGraph() {
  return new ApiError(502, "invalid_architecture", "The provider did not return a valid architecture graph.");
}
