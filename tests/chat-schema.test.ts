import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../src/lib/api/hardening.ts";
import { extractOpenRouterGraph, validateChatPayload, validateStackGraph } from "../src/lib/api/chat-schema.ts";

const validGraph = {
  nodes: [
    { id: "client", type: "tool", data: { label: "Web App", category: "Frontend", description: "User interface", rationale: "Delivers the requested browser workflow", tradeoff: "Requires careful offline-state handling" } },
    { id: "api", type: "tool", data: { label: "Cloud Run", category: "API", description: "Server routes", rationale: "Scales the private API to zero", tradeoff: "Cold starts can add latency" } },
    { id: "model", type: "tool", data: { label: "OpenRouter", category: "AI", description: "Model gateway", rationale: "Provides model routing flexibility", tradeoff: "Adds a provider dependency" } },
    { id: "metrics", type: "tool", data: { label: "Artificial Analysis", category: "Data", description: "Model metrics", rationale: "Adds comparable model evidence", tradeoff: "Metrics can lag new releases" } },
  ],
  edges: [
    { id: "client_api", source: "client", target: "api", label: "calls" },
    { id: "api_model", source: "api", target: "model", label: "uses" },
    { id: "api_metrics", source: "api", target: "metrics", label: "queries" },
  ],
};

test("chat payload accepts only one bounded prompt", () => {
  assert.equal(validateChatPayload({ prompt: "  Build a private RAG assistant.  " }), "Build a private RAG assistant.");
  for (const payload of [
    {},
    { prompt: "ok" },
    { prompt: 10 },
    { prompt: "valid prompt", extra: true },
    { prompt: `valid\u0000prompt` },
    { prompt: "x".repeat(2_001) },
  ]) {
    assert.throws(() => validateChatPayload(payload), isInvalidRequest);
  }
});

test("architecture graph validates exact fields and endpoints", () => {
  assert.deepEqual(validateStackGraph(validGraph), validGraph);
  assert.throws(() => validateStackGraph({ ...validGraph, extra: true }), isInvalidArchitecture);
  assert.throws(() => validateStackGraph({ ...validGraph, nodes: validGraph.nodes.slice(0, 3) }), isInvalidArchitecture);
  assert.throws(() => validateStackGraph({ ...validGraph, nodes: [...validGraph.nodes, validGraph.nodes[0]] }), isInvalidArchitecture);
  assert.throws(() => validateStackGraph({
    ...validGraph,
    nodes: validGraph.nodes.map((node, index) => index === 0
      ? { ...node, data: { ...node.data, rationale: "" } }
      : node),
  }), isInvalidArchitecture);
  assert.throws(() => validateStackGraph({
    ...validGraph,
    edges: [{ id: "bad", source: "client", target: "missing", label: "calls" }],
  }), isInvalidArchitecture);
  assert.throws(() => validateStackGraph({
    ...validGraph,
    edges: validGraph.edges.slice(0, 2),
  }), isInvalidArchitecture);
});

test("OpenRouter extraction accepts raw or fenced JSON and rejects malformed envelopes", () => {
  const encoded = JSON.stringify(validGraph);
  assert.deepEqual(extractOpenRouterGraph({ choices: [{ message: { content: encoded } }] }), validGraph);
  assert.deepEqual(extractOpenRouterGraph({ choices: [{ message: { content: `\n\`\`\`json\n${encoded}\n\`\`\`\n` } }] }), validGraph);
  assert.throws(() => extractOpenRouterGraph({ choices: [] }), isInvalidUpstream);
  assert.throws(() => extractOpenRouterGraph({ choices: [{ message: { content: "not-json" } }] }), isInvalidArchitecture);
});

function isInvalidRequest(error: unknown) {
  assert(error instanceof ApiError);
  assert.equal(error.status, 400);
  return true;
}

function isInvalidArchitecture(error: unknown) {
  assert(error instanceof ApiError);
  assert.equal(error.status, 502);
  assert.equal(error.code, "invalid_architecture");
  return true;
}

function isInvalidUpstream(error: unknown) {
  assert(error instanceof ApiError);
  assert.equal(error.status, 502);
  assert.equal(error.code, "invalid_upstream_response");
  return true;
}
