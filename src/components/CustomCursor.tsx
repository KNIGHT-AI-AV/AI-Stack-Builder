"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
    };

    const handlePointerDown = () => setIsActive(true);
    const handlePointerUp = () => setIsActive(false);

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  return (
    <div
      id="cursor"
      ref={cursorRef}
      className={`cursor ${isActive ? "active" : ""}`}
    >
      <Image
        src="/assets/media/royal-cursor.png"
        alt="Royal Gold Cursor"
        className="gold-cursor-img"
        width={32}
        height={32}
        unoptimized
      />
    </div>
  );
}
