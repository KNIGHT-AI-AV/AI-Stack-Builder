'use client';

import { useMemo } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node as ReactFlowNode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Download, FileText } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { StackGraph, StackGraphNodeData } from '@/lib/graph';
import { layoutStackGraph } from '@/lib/layout-graph';
import { buildArchitectureExport, buildArchitectureMarkdown } from '@/lib/architecture-export';
import styles from './GraphUI.module.css';

const CustomNode = ({ data }: { data: StackGraphNodeData }) => (
  <article className={styles.customNode}>
    <Handle className={styles.handle} type="target" position={Position.Top} isConnectable={false} />
    <div className={styles.category}>{data.category}</div>
    <h3 className={styles.title}>{data.label}</h3>
    <p className={styles.description}>{data.description}</p>
    <dl className={styles.reasoning}>
      <div>
        <dt>Why it fits</dt>
        <dd>{data.rationale}</dd>
      </div>
      <div>
        <dt>Tradeoff</dt>
        <dd>{data.tradeoff}</dd>
      </div>
    </dl>
    <Handle className={styles.handle} type="source" position={Position.Bottom} isConnectable={false} />
  </article>
);

const nodeTypes = { tool: CustomNode };

interface GraphUIProps {
  graph: StackGraph;
  prompt: string;
}

export default function GraphUI({ graph, prompt }: GraphUIProps) {
  const reduceMotion = useReducedMotion();
  const positions = useMemo(() => layoutStackGraph(graph.nodes, graph.edges), [graph.edges, graph.nodes]);
  const positionById = useMemo(() => new Map(positions.map((node) => [node.id, node.position])), [positions]);

  const nodes = useMemo<ReactFlowNode[]>(() => graph.nodes.map((node) => ({
    id: node.id,
    type: 'tool',
    position: positionById.get(node.id) ?? { x: 0, y: 0 },
    data: node.data,
    ariaLabel: `${node.data.category}: ${node.data.label}. ${node.data.description}. Why it fits: ${node.data.rationale}. Tradeoff: ${node.data.tradeoff}.`,
  })), [graph.nodes, positionById]);

  const edges = useMemo<Edge[]>(() => graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: !reduceMotion,
    style: { stroke: 'var(--red)', strokeWidth: 2 },
    labelStyle: {
      fill: '#f4f1ec',
      fontWeight: 600,
      fontFamily: 'var(--mono)',
      fontSize: '10px',
      textTransform: 'uppercase',
    },
    labelBgStyle: { fill: '#0f0f12', fillOpacity: 0.94 },
    labelBgPadding: [7, 4],
    labelBgBorderRadius: 4,
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--red)' },
  })), [graph.edges, reduceMotion]);

  const downloadFile = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const downloadArchitecture = () => {
    const payload = buildArchitectureExport(graph, prompt, new Date().toISOString());
    downloadFile('ai-stack-architecture.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  };

  const downloadImplementationPlan = () => {
    downloadFile('ai-stack-implementation-plan.md', buildArchitectureMarkdown(graph, prompt), 'text/markdown;charset=utf-8');
  };

  return (
    <motion.div
      className={styles.container}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.45 }}
    >
      <header className={styles.reportHeader}>
        <div>
          <span className={styles.eyebrow}>Generated architecture / Connected graph</span>
          <h2 className={styles.reportTitle} id="architecture-title">Architecture map</h2>
          <p className={styles.brief}>{prompt}</p>
        </div>
        <div className={styles.reportActions}>
          <dl className={styles.counts}>
            <div><dt>Components</dt><dd>{graph.nodes.length}</dd></div>
            <div><dt>Connections</dt><dd>{graph.edges.length}</dd></div>
          </dl>
          <div className={styles.downloadActions}>
            <button type="button" className={styles.exportButton} onClick={downloadImplementationPlan}>
              <FileText size={15} aria-hidden="true" /> Plan .md
            </button>
            <button type="button" className={styles.exportButton} onClick={downloadArchitecture}>
              <Download size={15} aria-hidden="true" /> Graph .json
            </button>
          </div>
        </div>
      </header>

      <div className={styles.canvas} aria-label="Interactive AI architecture graph">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.28 }}
          minZoom={0.2}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#ffffff" gap={24} size={1} style={{ opacity: 0.045 }} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </motion.div>
  );
}
