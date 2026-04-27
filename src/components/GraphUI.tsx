'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, Edge, Node as ReactFlowNode } from '@xyflow/react';
import { motion } from 'framer-motion';
import styles from './GraphUI.module.css';

interface NodeData {
  label: string;
  category: string;
  description: string;
  metrics?: {
    elo?: number;
    price?: number;
  };
}

const CustomNode = ({ data }: { data: NodeData }) => {
  return (
    <div className={styles.customNode}>
      <Handle type="target" position={Position.Top} style={{ background: 'var(--red)', border: 'none', width: '8px', height: '8px' }} />
      <div className={styles.category}>{data.category}</div>
      <div className={styles.title}>{data.label}</div>
      <div className={styles.description}>{data.description}</div>
      {data.metrics && (
        <div className={styles.metrics}>
          {data.metrics.elo && <span className={styles.metricBadge}>ELO: {data.metrics.elo}</span>}
          {data.metrics.price && <span className={styles.metricBadge}>${data.metrics.price}/1M</span>}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--hot-red)', border: 'none', width: '8px', height: '8px' }} />
    </div>
  );
};

const nodeTypes = {
  tool: CustomNode,
};

interface GraphUIProps {
  nodesData: any[];
  edgesData: any[];
}

export default function GraphUI({ nodesData, edgesData }: GraphUIProps) {
  const [nodes, setNodes] = useState<ReactFlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    if (!nodesData || nodesData.length === 0) return;

    // Simple vertical layout algorithm
    const layoutedNodes = nodesData.map((node, index) => {
      // Space them out vertically, center horizontally
      const x = 250; 
      const y = index * 200 + 50; 
      
      return {
        id: node.id,
        type: 'tool',
        position: { x, y },
        data: node.data,
      };
    });

    const formattedEdges = edgesData.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: true,
      style: { stroke: 'var(--red)', strokeWidth: 2 },
      labelStyle: { fill: '#fff', fontWeight: 500, fontFamily: 'var(--mono)', fontSize: '10px', textTransform: 'uppercase' },
      labelBgStyle: { fill: 'var(--bg-alt)', fillOpacity: 0.8 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--red)',
      },
    }));

    setNodes(layoutedNodes);
    setEdges(formattedEdges);
  }, [nodesData, edgesData]);

  if (!nodesData || nodesData.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          Your architecture graph will appear here.
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className={styles.container}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <ReactFlow 
        nodes={nodes} 
        edges={edges} 
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#ffffff" gap={20} size={1} style={{ opacity: 0.05 }} />
        <Controls style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg)', fill: 'white', borderRadius: '8px', border: '1px solid var(--rule)' }} />
      </ReactFlow>
    </motion.div>
  );
}
