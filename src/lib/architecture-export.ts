import type { StackGraph, StackGraphNode } from './graph';

export const ARCHITECTURE_EXPORT_SCHEMA = 'knight-ai-av/ai-stack-architecture' as const;
const MARKDOWN_INLINE_SPECIALS = new Set(['\\', '`', '*', '_', '{', '}', '[', ']', '(', ')', '#', '+', '!', '|', '>']);

export interface ArchitectureExportEnvelope {
  schema: typeof ARCHITECTURE_EXPORT_SCHEMA;
  version: 1;
  exportedAtUtc: string;
  brief: string;
  architecture: StackGraph;
}

export function buildArchitectureExport(
  graph: StackGraph,
  brief: string,
  exportedAtUtc: string,
): ArchitectureExportEnvelope {
  return {
    schema: ARCHITECTURE_EXPORT_SCHEMA,
    version: 1,
    exportedAtUtc,
    brief: brief.trim(),
    architecture: graph,
  };
}

export function architectureBuildOrder(graph: StackGraph): StackGraphNode[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const incoming = new Map(graph.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(graph.nodes.map((node) => [node.id, [] as string[]]));

  for (const edge of graph.edges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }

  const queue = graph.nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  const ordered: StackGraphNode[] = [];
  const visited = new Set<string>();
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    if (visited.has(id)) continue;
    visited.add(id);
    const node = nodeById.get(id);
    if (node) ordered.push(node);
    for (const target of outgoing.get(id) ?? []) {
      const remaining = (incoming.get(target) ?? 1) - 1;
      incoming.set(target, remaining);
      if (remaining === 0) queue.push(target);
    }
  }

  // Valid architecture responses may describe a feedback loop. Preserve the
  // model's stable node order for the cyclic remainder instead of dropping it.
  for (const node of graph.nodes) {
    if (!visited.has(node.id)) ordered.push(node);
  }
  return ordered;
}

export function buildArchitectureMarkdown(graph: StackGraph, brief: string) {
  const labels = new Map(graph.nodes.map((node) => [node.id, node.data.label]));
  const components = architectureBuildOrder(graph).map((node, index) => [
    `${index + 1}. **${markdownText(node.data.label)}** _(${markdownText(node.data.category)})_`,
    `   - Purpose: ${markdownText(node.data.description)}`,
    `   - Why it fits: ${markdownText(node.data.rationale)}`,
    `   - Tradeoff: ${markdownText(node.data.tradeoff)}`,
  ].join('\n'));
  const connections = graph.edges.map((edge) =>
    `- **${markdownText(labels.get(edge.source) ?? edge.source)}** → **${markdownText(labels.get(edge.target) ?? edge.target)}**: ${markdownText(edge.label)}`,
  );

  return [
    '# AI Stack Architecture',
    '',
    '## Product brief',
    '',
    markdownText(brief.trim()),
    '',
    '## Recommended build order',
    '',
    ...components,
    '',
    '## Connections',
    '',
    ...connections,
    '',
  ].join('\n');
}

function markdownText(value: string) {
  return [...value.replace(/\s+/g, ' ').trim()]
    .map((character) => MARKDOWN_INLINE_SPECIALS.has(character) ? `\\${character}` : character)
    .join('');
}
