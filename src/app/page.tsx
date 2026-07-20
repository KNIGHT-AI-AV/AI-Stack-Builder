'use client';

import React, { useState } from 'react';
import ChatUI from '@/components/ChatUI';
import GraphUI from '@/components/GraphUI';
import { motion, AnimatePresence } from 'framer-motion';
import type { StackGraph } from '@/lib/graph';

interface ApiErrorPayload {
  error?: {
    message?: string;
  };
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [graphData, setGraphData] = useState<StackGraph | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChatSubmit = async (prompt: string) => {
    setIsLoading(true);
    setGraphData(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null) as ApiErrorPayload | null;
        throw new Error(payload?.error?.message || 'The architecture service could not complete this request.');
      }

      const data = await res.json() as StackGraph;
      setGraphData(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The architecture service could not complete this request.');
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

      <ChatUI onSubmit={handleChatSubmit} isLoading={isLoading} errorMessage={errorMessage} />

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
