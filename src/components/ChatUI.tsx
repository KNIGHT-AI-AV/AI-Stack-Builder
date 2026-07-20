'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import styles from './ChatUI.module.css';

interface ChatUIProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
}

export default function ChatUI({ onSubmit, isLoading, errorMessage }: ChatUIProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSubmit(input);
    }
  };

  return (
    <motion.div 
      className={styles.container}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className={styles.header}>
        <motion.h1 
          className={styles.title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          AI Stack Builder
        </motion.h1>
        <motion.p 
          className={styles.subtitle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Describe what you want to build. We&apos;ll architect the perfect 2026 stack.
        </motion.p>
      </div>

      <motion.form 
        className={styles.inputWrapper} 
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
      >
        <input
          type="text"
          className={styles.input}
          placeholder="e.g. I want to build an autonomous CRM tool..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          maxLength={2000}
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={errorMessage ? "architecture-error" : undefined}
        />
        <button 
          type="submit" 
          className={styles.submitBtn}
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? (
            <>Architecting... <Loader2 className={styles.loader} size={16} /></>
          ) : (
            <>Architect <span className="kr-arrow">→</span></>
          )}
        </button>
      </motion.form>
      {errorMessage && (
        <p className={styles.error} id="architecture-error" role="alert">
          {errorMessage}
        </p>
      )}
    </motion.div>
  );
}
