import Image from 'next/image';
import Link from 'next/link';
import styles from './TopNav.module.css';

export default function TopNav() {
  return (
    <header className={styles.navHeader}>
      <div className={styles.navContent}>
        <Link href="#brief" className={styles.brand}>
          <Image
            src="/assets/brand/icons/ai-stack-builder-icon-192.png"
            alt=""
            aria-hidden="true"
            className={styles.brandMark}
            width={192}
            height={192}
            preload
            unoptimized
          />
          <span className={styles.brandType}>
            <span className={styles.brandWordmark}>
              AI STACK <span className={styles.brandAccent}>BUILDER</span>
            </span>
            <span className={styles.brandParent}>BY KNIGHT AI+AV</span>
          </span>
        </Link>
        <div className={styles.navRow}>
          <nav className={styles.navLinks} aria-label="Builder navigation">
            <Link href="#brief"><span>01</span> Brief</Link>
            <Link href="#architecture"><span>02</span> Architecture</Link>
            <Link href="https://knightaiav.com/ai-rankings.html">Model rankings <span aria-hidden="true">↗</span></Link>
          </nav>
          <Link href="#brief" className={styles.buildButton}>
            Create map
          </Link>
        </div>
      </div>
    </header>
  );
}
