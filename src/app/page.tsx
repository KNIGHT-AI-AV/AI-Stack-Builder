'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import ChatUI from '@/components/ChatUI';
import GraphUI from '@/components/GraphUI';
import type { StackGraph } from '@/lib/graph';
import styles from './page.module.css';

interface ApiErrorPayload {
  error?: {
    message?: string;
  };
}

const FALLBACK_ERROR = 'The architecture service could not complete this request.';
const API_BASE_URL = (process.env.NEXT_PUBLIC_AI_STACK_API_BASE_URL || '').replace(/\/+$/, '');

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [graphData, setGraphData] = useState<StackGraph | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activePrompt, setActivePrompt] = useState('');
  const requestSequence = useRef(0);
  const reduceMotion = useReducedMotion();

  const handleChatSubmit = async (prompt: string) => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setIsLoading(true);
    setGraphData(null);
    setErrorMessage(null);
    setActivePrompt(prompt);

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null) as ApiErrorPayload | null;
        throw new Error(payload?.error?.message || FALLBACK_ERROR);
      }

      const data = await res.json() as StackGraph;
      if (sequence !== requestSequence.current) return;
      setGraphData(data);
      window.requestAnimationFrame(() => {
        document.querySelector('#architecture')?.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'start',
        });
      });
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setErrorMessage(error instanceof Error ? error.message : FALLBACK_ERROR);
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <section className={styles.briefStage} aria-labelledby="builder-title">
        <ChatUI onSubmit={handleChatSubmit} isLoading={isLoading} errorMessage={errorMessage} />
      </section>

      <AnimatePresence>
        {graphData && (
          <motion.section
            id="architecture"
            className={styles.resultStage}
            aria-labelledby="architecture-title"
            initial={reduceMotion ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.5, ease: 'easeOut' }}
          >
            <GraphUI graph={graphData} prompt={activePrompt} />
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
