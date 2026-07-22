import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARCHITECTURE_EXPORT_SCHEMA,
  architectureBuildOrder,
  buildArchitectureExport,
  buildArchitectureMarkdown,
} from '../src/lib/architecture-export.ts';
import type { StackGraph } from '../src/lib/graph.ts';

const graph: StackGraph = {
  nodes: ['client', 'api', 'model', 'data'].map((id) => ({
    id,
    type: 'tool',
    data: {
      label: id === 'api' ? 'API *Gateway*' : id,
      category: 'Test',
      description: `${id} purpose`,
      rationale: `${id} matches the brief`,
      tradeoff: `${id} has a cost`,
    },
  })),
  edges: [
    { id: 'client_api', source: 'client', target: 'api', label: 'calls' },
    { id: 'api_model', source: 'api', target: 'model', label: 'uses' },
    { id: 'api_data', source: 'api', target: 'data', label: 'stores' },
  ],
};

test('versioned JSON export preserves the validated architecture and brief', () => {
  assert.deepEqual(buildArchitectureExport(graph, '  Build a private assistant.  ', '2026-07-20T00:00:00.000Z'), {
    schema: ARCHITECTURE_EXPORT_SCHEMA,
    version: 1,
    exportedAtUtc: '2026-07-20T00:00:00.000Z',
    brief: 'Build a private assistant.',
    architecture: graph,
  });
});

test('Markdown handoff follows dependency order and includes rationale, tradeoffs, and connections', () => {
  assert.deepEqual(architectureBuildOrder(graph).map((node) => node.id), ['client', 'api', 'model', 'data']);
  const markdown = buildArchitectureMarkdown(graph, 'Build a private assistant.');
  assert.match(markdown, /^# AI Stack Architecture/);
  assert.match(markdown, /Why it fits: api matches the brief/);
  assert.match(markdown, /Tradeoff: api has a cost/);
  assert(markdown.includes('API \\*Gateway\\*'));
  assert(markdown.includes('**API \\*Gateway\\*** → **model**'));
});

test('build order keeps every component when the architecture contains a feedback loop', () => {
  const cyclic: StackGraph = {
    ...graph,
    edges: [...graph.edges, { id: 'data_client', source: 'data', target: 'client', label: 'informs' }],
  };
  assert.deepEqual(architectureBuildOrder(cyclic).map((node) => node.id), graph.nodes.map((node) => node.id));
});
