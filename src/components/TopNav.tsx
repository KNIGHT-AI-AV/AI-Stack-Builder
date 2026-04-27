"use client";

import Image from 'next/image';
import Link from 'next/link';
import styles from './TopNav.module.css';

export default function TopNav() {
  return (
    <header className={styles.navHeader}>
      <div className={styles.navContent}>
        <Link href="/" className={styles.brand}>
          <Image
            src="/assets/media/knight-helm-gold-192.webp"
            alt="Knight AI+AV Mark"
            className={styles.brandMark}
            width={192}
            height={192}
            unoptimized
          />
          <span className={styles.brandWordmark}>
            KNIGHT <span className={styles.brandAccent}>AI+AV</span>
          </span>
        </Link>
        <div className={styles.navRow}>
          <Link href="/" className={styles.navHomeBtn} aria-label="Home">
            <svg className={styles.navHomeIco} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 11.5L12 3l9 8.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1v-9.5z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"/>
            </svg>
            <span>Home</span>
          </Link>
          <div className={styles.navSegmented}>
            <span className={styles.navSegmentedIndicator} aria-hidden="true"></span>
            <nav className={styles.navLinks}>
              <Link href="#work">01 Work</Link>
              <Link href="#services">02 Services</Link>
              <Link href="#about">03 About</Link>
              <Link href="#contact">04 Contact</Link>
            </nav>
          </div>
          <div className={styles.navIntel}>
            <Link href="https://knightaiav.com/ai-rankings.html" className="nav-intel-btn">
              Rankings
            </Link>
          </div>
          <span className={styles.navDivider} aria-hidden="true"></span>
          <Link href="#contact" className="cta-pill">
            Start a project
          </Link>
        </div>
      </div>
    </header>
  );
}
