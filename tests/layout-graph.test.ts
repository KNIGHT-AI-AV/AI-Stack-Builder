import assert from 'node:assert/strict';
import test from 'node:test';
import { layoutStackGraph } from '../src/lib/layout-graph.ts';
import type { StackGraphEdge, StackGraphNode } from '../src/lib/graph.ts';

const nodes: StackGraphNode[] = ['brief', 'api', 'model', 'data'].map((id) => ({
  id,
  type: 'tool',
  data: {
    label: id,
    category: 'Test',
    description: `${id} component`,
    rationale: `${id} fits the test brief`,
    tradeoff: `${id} has a test tradeoff`,
  },
}));

test('graph layout gives a branching DAG stable architecture rows', () => {
  const edges: StackGraphEdge[] = [
    { id: 'brief_api', source: 'brief', target: 'api', label: 'calls' },
    { id: 'brief_model', source: 'brief', target: 'model', label: 'asks' },
    { id: 'api_data', source: 'api', target: 'data', label: 'stores' },
    { id: 'model_data', source: 'model', target: 'data', label: 'reads' },
  ];
  const positions = new Map(layoutStackGraph(nodes, edges).map((node) => [node.id, node.position]));

  assert.equal(positions.get('brief')?.y, 0);
  assert.equal(positions.get('api')?.y, positions.get('model')?.y);
  assert.notEqual(positions.get('api')?.x, positions.get('model')?.x);
  assert((positions.get('data')?.y ?? 0) > (positions.get('api')?.y ?? 0));
});

test('graph layout remains finite and deterministic for a connected cycle', () => {
  const edges: StackGraphEdge[] = [
    { id: 'one', source: 'brief', target: 'api', label: 'calls' },
    { id: 'two', source: 'api', target: 'model', label: 'uses' },
    { id: 'three', source: 'model', target: 'data', label: 'reads' },
    { id: 'four', source: 'data', target: 'brief', label: 'informs' },
  ];
  const first = layoutStackGraph(nodes, edges);
  const second = layoutStackGraph(nodes, edges);

  assert.deepEqual(first, second);
  assert(first.every((node) => Number.isFinite(node.position.x) && Number.isFinite(node.position.y)));
  assert.equal(new Set(first.map((node) => `${node.position.x}:${node.position.y}`)).size, nodes.length);
});
