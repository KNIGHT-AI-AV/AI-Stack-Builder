import type { StackGraphEdge, StackGraphNode } from './graph';

const NODE_WIDTH = 280;
const HORIZONTAL_GAP = 120;
const VERTICAL_GAP = 320;

export interface PositionedStackNode {
  id: string;
  position: {
    x: number;
    y: number;
  };
}

export function layoutStackGraph(
  nodes: readonly StackGraphNode[],
  edges: readonly StackGraphEdge[],
): PositionedStackNode[] {
  if (nodes.length === 0) return [];
  const depths = topologicalDepths(nodes, edges) ?? undirectedDepths(nodes, edges);
  const rows = new Map<number, StackGraphNode[]>();

  for (const node of nodes) {
    const depth = depths.get(node.id) ?? 0;
    const row = rows.get(depth) ?? [];
    row.push(node);
    rows.set(depth, row);
  }

  const positions = new Map<string, PositionedStackNode['position']>();
  const orderedDepths = [...rows.keys()].sort((left, right) => left - right);
  orderedDepths.forEach((depth, rowIndex) => {
    const row = rows.get(depth) ?? [];
    const rowWidth = row.length * NODE_WIDTH + Math.max(0, row.length - 1) * HORIZONTAL_GAP;
    row.forEach((node, columnIndex) => {
      positions.set(node.id, {
        x: columnIndex * (NODE_WIDTH + HORIZONTAL_GAP) - rowWidth / 2,
        y: rowIndex * VERTICAL_GAP,
      });
    });
  });

  return nodes.map((node) => ({ id: node.id, position: positions.get(node.id) ?? { x: 0, y: 0 } }));
}

function topologicalDepths(nodes: readonly StackGraphNode[], edges: readonly StackGraphEdge[]) {
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const depths = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }

  const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  let processed = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const source = queue[cursor];
    processed += 1;
    for (const target of outgoing.get(source) ?? []) {
      depths.set(target, Math.max(depths.get(target) ?? 0, (depths.get(source) ?? 0) + 1));
      const remaining = (incoming.get(target) ?? 1) - 1;
      incoming.set(target, remaining);
      if (remaining === 0) queue.push(target);
    }
  }

  return processed === nodes.length ? depths : null;
}

function undirectedDepths(nodes: readonly StackGraphNode[], edges: readonly StackGraphEdge[]) {
  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }

  const root = nodes.find((node) => incoming.get(node.id) === 0)?.id ?? nodes[0].id;
  const depths = new Map([[root, 0]]);
  const queue = [root];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const source = queue[cursor];
    for (const target of adjacency.get(source) ?? []) {
      if (depths.has(target)) continue;
      depths.set(target, (depths.get(source) ?? 0) + 1);
      queue.push(target);
    }
  }
  return depths;
}
