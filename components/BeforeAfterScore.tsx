"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { getKnowledgeHealthColor, getKnowledgeHealthLabel } from "@/lib/health-utils";

interface BeforeAfterScoreProps {
  previousScore: number;
  newScore: number;
  improvement: number;
  improvedTopics: string[];
}

function AnimatedScore({ target, color }: { target: number; color: string }) {
  const [current, setCurrent] = useState(0);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const duration = 1400;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * target));
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [target]);

  const r = 50;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (current / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg width="112" height="112" viewBox="0 0 112 112">
          <circle cx="56" cy="56" r={r} fill="none" stroke="#e5e0d8" strokeWidth="8" />
          <circle
            cx="56"
            cy="56"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "center",
              filter: `drop-shadow(0 0 8px ${color}66)`,
            }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-3xl font-bold"
          style={{ color }}
          translate="no"
        >
          {current}
        </div>
      </div>
      <span
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color }}
        translate="no"
      >
        {getKnowledgeHealthLabel(current)}
      </span>
    </div>
  );
}

export default function BeforeAfterScore({
  previousScore,
  newScore,
  improvement,
  improvedTopics,
}: BeforeAfterScoreProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const prevColor = getKnowledgeHealthColor(previousScore);
  const newColor = getKnowledgeHealthColor(newScore);

  if (!visible) return null;

  return (
    <div className="flex flex-col items-center gap-6 py-4 animate-fade-in">
      {/* Sparkles header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-[#ff6b35]" />
        <h3 className="text-lg font-bold text-[#1a1a2e]">
          Knowledge Health Updated!
        </h3>
        <Sparkles className="w-5 h-5 text-[#ff6b35]" />
      </div>

      {/* Score comparison */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Before</p>
          <AnimatedScore target={previousScore} color={prevColor} />
        </div>

        <div className="flex flex-col items-center gap-2">
          <ArrowRight className="w-8 h-8 text-[#ff6b35]" />
          <div
            className="text-lg font-bold px-3 py-1 rounded-xl"
            style={{
              background: improvement > 0 ? "#f0fdf4" : "#fef2f2",
              color: improvement > 0 ? "#22c55e" : "#ef4444",
            }}
          >
            {improvement > 0 ? "+" : ""}{improvement} pts
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">After</p>
          <AnimatedScore target={newScore} color={newColor} />
        </div>
      </div>

      {/* Improved topics */}
      {improvedTopics.length > 0 && (
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">
            You helped fill gaps in:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {improvedTopics.map((topic) => (
              <span
                key={topic}
                className="text-xs px-3 py-1 rounded-full font-medium bg-green-100 text-green-700 border border-green-200"
              >
                ✓ {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Thank you message */}
      <div
        className="w-full rounded-2xl p-4 text-center"
        style={{ background: "linear-gradient(135deg, #fff7f4, #fffbeb)" }}
      >
        <p className="text-sm font-medium text-[#1a1a2e]">
          Thank you for helping future travelers make better decisions!
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Your insights will help Expedia surface more accurate property information.
        </p>
      </div>
    </div>
  );
}
