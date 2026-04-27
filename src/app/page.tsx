'use client';

import React, { useState } from 'react';
import ChatUI from '@/components/ChatUI';
import GraphUI from '@/components/GraphUI';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[] } | null>(null);

  const handleChatSubmit = async (prompt: string) => {
    setIsLoading(true);
    setGraphData(null); // Reset graph

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await res.json();
      
      // We can also trigger the metrics fetch here if needed, 
      // but for MVP we will just render what the AI returned.
      
      setGraphData({
        nodes: data.nodes || [],
        edges: data.edges || []
      });
    } catch (error) {
      console.error('Error generating graph:', error);
      // Fallback dummy data if API fails locally without key just to show it works
      setGraphData({
        nodes: [
          { id: '1', data: { label: 'Cursor', category: 'IDE', description: 'AI-First IDE' } },
          { id: '2', data: { label: 'Vercel Sandbox', category: 'Hosting', description: 'Agent Runtime' } }
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2', label: 'deploys to' }
        ]
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem' }}>
      
      {/* Spacer when no graph is present to center the chat */}
      <motion.div 
        animate={{ height: graphData ? '5vh' : '25vh' }} 
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />

      <ChatUI onSubmit={handleChatSubmit} isLoading={isLoading} />

      <AnimatePresence>
        {graphData && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            style={{ width: '100%', maxWidth: '1200px' }}
          >
            <GraphUI nodesData={graphData.nodes} edgesData={graphData.edges} />
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}
