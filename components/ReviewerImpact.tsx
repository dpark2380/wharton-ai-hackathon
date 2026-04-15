"use client";

import { useEffect, useState } from "react";
import {
  calculatePointsEarned, getLevel, getNextLevel, progressToNextLevel,
  addPoints, getStoredPoints, EXCLUSIVE_DEALS, type Level,
} from "@/lib/levels";
import { getTopicById } from "@/lib/topics";

interface ReviewerImpactProps {
  accountId: string;
  reviewText: string;
  answerCount: number;
  photoCount: number;
  improvedTopics: string[];
}

export default function ReviewerImpact({
  accountId,
  reviewText,
  answerCount,
  photoCount,
  improvedTopics,
}: ReviewerImpactProps) {
  const [mounted, setMounted] = useState(false);
  const [prevPoints, setPrevPoints] = useState(0);
  const [newPoints, setNewPoints] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const { total: pointsEarned, breakdown } = calculatePointsEarned(reviewText, answerCount, photoCount);

  useEffect(() => {
    const before = getStoredPoints(accountId);
    const after = addPoints(accountId, pointsEarned);
    setPrevPoints(before);
    setNewPoints(after);

    const prevLevel = getLevel(before).level;
    const newLevel = getLevel(after).level;
    if (newLevel > prevLevel) {
      setTimeout(() => setShowLevelUp(true), 600);
    }

    setMounted(true);
  }, []);

  if (!mounted) return null;

  const currentLevel = getLevel(newPoints);
  const nextLevel = getNextLevel(newPoints);
  const progress = progressToNextLevel(newPoints);
  const prevLevel = getLevel(prevPoints);
  const leveledUp = currentLevel.level > prevLevel.level;

  return (
    <div className="space-y-5 animate-fade-in py-2">
      {/* Level-up banner */}
      {leveledUp && showLevelUp && (
        <div
          className="rounded-2xl p-4 text-center animate-fade-in"
          style={{ background: `linear-gradient(135deg, ${currentLevel.color}20, ${currentLevel.color}10)`, border: `1.5px solid ${currentLevel.color}40` }}
        >
          <p className="text-2xl mb-1">{currentLevel.badge ?? "🎉"}</p>
          <p className="text-base font-extrabold" style={{ color: currentLevel.color }}>
            Level Up! You reached {currentLevel.name}
          </p>
          <p className="text-xs text-gray-500 mt-1">New perks unlocked. See below.</p>
        </div>
      )}

      {/* Points earned */}
      <div className="bg-[#faf8f5] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-[#1a1a2e]">Points Earned</p>
          <span
            className="text-lg font-extrabold"
            style={{ color: currentLevel.color }}
          >
            +{pointsEarned} pts
          </span>
        </div>
        <div className="space-y-1.5">
          {breakdown.map((b) => (
            <div key={b.label} className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{b.label}</span>
              <span className="font-semibold text-[#1a1a2e]">+{b.points}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Level progress */}
      <div className="bg-white border border-[#e5e0d8] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {currentLevel.badge && <span className="text-lg">{currentLevel.badge}</span>}
            <div>
              <p className="text-sm font-bold text-[#1a1a2e]">Level {currentLevel.level}: {currentLevel.name}</p>
              <p className="text-xs text-gray-400">{newPoints.toLocaleString()} total points</p>
            </div>
          </div>
          {nextLevel && (
            <p className="text-xs text-gray-400 text-right">
              {(nextLevel.minPoints - newPoints).toLocaleString()} pts to<br />
              <span className="font-semibold" style={{ color: nextLevel.color }}>{nextLevel.name}</span>
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${Math.round(progress * 100)}%`, background: currentLevel.color }}
          />
        </div>
        {!nextLevel && (
          <p className="text-xs text-gray-400 mt-1 text-center">Maximum level reached</p>
        )}
      </div>

      {/* Topics covered */}
      {improvedTopics.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">You helped fill gaps in</p>
          <div className="flex flex-wrap gap-1.5">
            {improvedTopics.map((t) => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-50 text-green-700 border border-green-200">
                ✓ {getTopicById(t)?.label ?? t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Perks */}
      {currentLevel.perks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Your {currentLevel.name} Perks
          </p>
          <div className="space-y-2">
            {currentLevel.perks.map((perk) => (
              <div key={perk.title} className="flex items-start gap-3 bg-white border border-[#e5e0d8] rounded-xl px-3 py-2.5">
                <span className="text-base flex-shrink-0">{perk.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-[#1a1a2e]">{perk.title}</p>
                  <p className="text-xs text-gray-500">{perk.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demo disclaimer */}
      <p className="text-[10px] text-gray-400 text-center leading-relaxed px-2">
        Score changes are amplified in this demo to make the impact visible. In production, a single review would typically shift the score by 1–3 points.
      </p>

      {/* Exclusive deals (Level 3+) */}
      {currentLevel.level >= 3 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Exclusive Early Access Deals
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
              {currentLevel.level >= 5 ? "72h early" : currentLevel.level >= 4 ? "48h early" : "24h early"}
            </span>
          </div>
          <div className="space-y-2">
            {EXCLUSIVE_DEALS.map((deal) => (
              <div
                key={deal.hotel}
                className="rounded-xl border p-3"
                style={{ background: "linear-gradient(135deg, #fff7f4, #fffbeb)", borderColor: "#fde68a" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-[#1a1a2e]">{deal.hotel}</p>
                    <p className="text-xs text-gray-400">{deal.location}</p>
                  </div>
                  <span className="text-xs font-extrabold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex-shrink-0">
                    {deal.discount}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs line-through text-gray-400">{deal.originalRate}</span>
                  <span className="text-sm font-bold text-[#1a1a2e]">{deal.dealRate}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">Expires in {deal.expiresIn}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-center">
            These deals go public in {currentLevel.level >= 5 ? "72" : currentLevel.level >= 4 ? "48" : "24"} hours. Available to {currentLevel.name}s and above only.
          </p>
        </div>
      )}
    </div>
  );
}
