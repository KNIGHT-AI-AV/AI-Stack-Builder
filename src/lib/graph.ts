export interface StackGraphNodeData extends Record<string, unknown> {
  label: string;
  category: string;
  description: string;
  rationale: string;
  tradeoff: string;
}

export interface StackGraphNode {
  id: string;
  type: "tool";
  data: StackGraphNodeData;
}

export interface StackGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface StackGraph {
  nodes: StackGraphNode[];
  edges: StackGraphEdge[];
}
