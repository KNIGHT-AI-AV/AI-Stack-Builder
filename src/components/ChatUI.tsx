'use client';

import { type FormEvent, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import styles from './ChatUI.module.css';

interface ChatUIProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
}

const EXAMPLE_PROMPTS = [
  {
    label: 'Private RAG',
    prompt: 'Build a private RAG assistant for a legal team with cited answers, document permissions, and no training on client data.',
  },
  {
    label: 'Voice agent',
    prompt: 'Build a low-latency voice concierge that can answer product questions, book appointments, and hand off to a human.',
  },
  {
    label: 'Video studio',
    prompt: 'Build an AI video studio that turns a campaign brief into scripts, brand-safe images, voiceover, and short social edits.',
  },
] as const;

export default function ChatUI({ onSubmit, isLoading, errorMessage }: ChatUIProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reduceMotion = useReducedMotion();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = input.trim();
    if (prompt.length >= 3 && !isLoading) onSubmit(prompt);
  };

  const chooseExample = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <motion.div
      id="brief"
      className={styles.container}
      initial={reduceMotion ? false : { opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.6, ease: 'easeOut' }}
    >
      <div className={styles.header}>
        <motion.div
          className={styles.heroBrand}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.65, ease: 'easeOut' }}
        >
          <Image
            src="/assets/brand/icons/ai-stack-builder-icon-192.png"
            alt=""
            aria-hidden="true"
            width={192}
            height={192}
            className={styles.heroMark}
            unoptimized
          />
          <span className={styles.eyebrow}>Knight AI+AV / Architecture intelligence</span>
        </motion.div>
        <motion.h1
          id="builder-title"
          className={styles.title}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.2 }}
        >
          AI Stack Builder
        </motion.h1>
        <motion.p
          className={styles.subtitle}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.3 }}
        >
          Turn one product brief into a connected, inspectable 2026 AI architecture.
        </motion.p>
      </div>

      <ol className={styles.protocol} aria-label="Architecture workflow">
        <li><span>01</span> Brief</li>
        <li><span>02</span> Generate</li>
        <li><span>03</span> Inspect</li>
      </ol>

      <motion.form
        className={styles.form}
        onSubmit={handleSubmit}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: reduceMotion ? 0 : 0.35 }}
        aria-busy={isLoading}
      >
        <label className="sr-only" htmlFor="architecture-prompt">Describe the product you want to architect</label>
        <div className={styles.inputWrapper}>
          <textarea
            ref={inputRef}
            id="architecture-prompt"
            className={styles.input}
            placeholder="Describe the users, must-have capabilities, data constraints, and deployment needs…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            disabled={isLoading}
            maxLength={2000}
            rows={3}
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? 'architecture-error prompt-guidance' : 'prompt-guidance'}
          />
          <div className={styles.formFooter}>
            <span className={styles.guidance} id="prompt-guidance">Enter to generate · Shift + Enter for a new line</span>
            <span className={styles.characterCount} aria-label={`${input.length} of 2000 characters`}>{input.length} / 2000</span>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={input.trim().length < 3 || isLoading}
            >
              {isLoading ? (
                <>Building map <Loader2 className={styles.loader} size={16} aria-hidden="true" /></>
              ) : (
                <>Generate map <Sparkles size={15} aria-hidden="true" /></>
              )}
            </button>
          </div>
        </div>
      </motion.form>

      <div className={styles.examples} aria-label="Example briefs">
        <span className={styles.examplesLabel}>Start with an example</span>
        <div className={styles.exampleList}>
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example.label}
              type="button"
              className={styles.exampleButton}
              onClick={() => chooseExample(example.prompt)}
              disabled={isLoading}
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <p className={styles.error} id="architecture-error" role="alert">
          {errorMessage}
        </p>
      )}
    </motion.div>
  );
}
