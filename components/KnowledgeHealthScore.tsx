"use client";

import { useEffect, useRef, useState } from "react";
import { getKnowledgeHealthColor, getKnowledgeHealthLabel } from "@/lib/health-utils";

interface KnowledgeHealthScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  showLabel?: boolean;
}

const SIZES = {
  sm: { dim: 64, stroke: 5, r: 26, fontSize: "text-base font-bold" },
  md: { dim: 96, stroke: 7, r: 38, fontSize: "text-2xl font-bold" },
  lg: { dim: 140, stroke: 9, r: 58, fontSize: "text-4xl font-bold" },
};

export default function KnowledgeHealthScore({
  score,
  size = "md",
  animated = true,
  showLabel = false,
}: KnowledgeHealthScoreProps) {
  const { dim, stroke, r, fontSize } = SIZES[size];
  const circumference = 2 * Math.PI * r;
  const color = getKnowledgeHealthColor(score);
  const label = getKnowledgeHealthLabel(score);

  // Always start at actual score for SSR — no mismatch
  const [displayScore, setDisplayScore] = useState(score);
  const [dashOffset, setDashOffset] = useState(
    circumference - (score / 100) * circumference
  );
  const animRef = useRef<number | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!animated) return;
    // Only animate after mount (never on SSR)
    if (!mounted.current) {
      mounted.current = true;
      // Reset to 0 then animate up
      setDisplayScore(0);
      setDashOffset(circumference);
    }

    const duration = 1200;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));
      setDashOffset(circumference - (eased * score / 100) * circumference);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const cx = dim / 2;
  const cy = dim / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ width: dim, height: dim }} className="relative">
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e0d8" strokeWidth={stroke} />
          {/* Progress */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "center",
              filter: `drop-shadow(0 0 6px ${color}55)`,
            }}
          />
        </svg>
        <div
          className={`absolute inset-0 flex items-center justify-center ${fontSize}`}
          style={{ color }}
          suppressHydrationWarning
        >
          {displayScore}
        </div>
      </div>
      {showLabel && (
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color }}
          translate="no"
        >
          {label}
        </span>
      )}
    </div>
  );
}
