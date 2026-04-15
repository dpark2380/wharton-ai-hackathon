"use client";

import { useState, useEffect } from "react";
import { Brain, RefreshCw, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from "lucide-react";

// ── Types (mirrored from lib/ml/continuous-learning.ts) ───────────────────────

interface TopicImportance {
  topicId: string;
  topicLabel: string;
  weight: number;
  defaultWeight: number;
  delta: number;
  reviewCount: number;
  correlation: number;
}

interface SentimentBlend {
  topicId: string;
  topicLabel: string;
  structuredWeight: number;
  textWeight: number;
  defaultStructuredWeight: number;
  delta: number;
  reviewCount: number;
  hasStructuredData: boolean;
}

interface LearnedWeights {
  propertyId: string;
  topicImportance: TopicImportance[];
  sentimentBlend: SentimentBlend[];
  reviewsUsed: number;
  trainedAt: string;
  previousTrainedAt: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function DeltaChip({ delta }: { delta: number }) {
  const pct = Math.round(Math.abs(delta) * 100);
  if (pct < 1) return <Minus className="w-3 h-3 text-gray-300" />;
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
      <TrendingUp className="w-3 h-3" /> +{pct}%
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-500">
      <TrendingDown className="w-3 h-3" /> -{pct}%
    </span>
  );
}

// ── Topic importance row ──────────────────────────────────────────────────────

function ImportanceRow({ topic }: { topic: TopicImportance }) {
  const learnedPct = Math.round(topic.weight * 100);
  const defaultPct = Math.round(topic.defaultWeight * 100);

  return (
    <div className="py-2.5 border-b border-[#f5f2ee] last:border-0">
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-xs font-semibold text-[#1a1a2e] w-36 shrink-0 truncate">
          {topic.topicLabel}
        </span>
        <div className="flex-1 relative h-3 bg-gray-100 rounded-full overflow-hidden">
          {/* Default weight marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-gray-300 z-10"
            style={{ left: `${defaultPct * 2}%` }}
          />
          {/* Learned weight bar */}
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, learnedPct * 2)}%`,
              background: topic.delta > 0.01
                ? "linear-gradient(90deg, #22c55e, #16a34a)"
                : topic.delta < -0.01
                ? "linear-gradient(90deg, #f97316, #ea580c)"
                : "#94a3b8",
            }}
          />
        </div>
        <span className="text-[11px] font-bold text-[#1a1a2e] w-8 text-right">{learnedPct}%</span>
        <div className="w-14 flex justify-end">
          <DeltaChip delta={topic.delta} />
        </div>
      </div>
      <div className="flex items-center gap-3 pl-36 text-[10px] text-gray-400">
        <span>Default: {defaultPct}%</span>
        <span>·</span>
        <span>r = {topic.correlation.toFixed(2)}</span>
        <span>·</span>
        <span>{topic.reviewCount} reviews</span>
      </div>
    </div>
  );
}

// ── Sentiment blend row ───────────────────────────────────────────────────────

function BlendRow({ blend }: { blend: SentimentBlend }) {
  if (!blend.hasStructuredData) return null;

  const s1Pct = Math.round(blend.structuredWeight * 100);
  const s2Pct = Math.round(blend.textWeight * 100);
  const defaultS1Pct = Math.round(blend.defaultStructuredWeight * 100);

  return (
    <div className="py-2.5 border-b border-[#f5f2ee] last:border-0">
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-xs font-semibold text-[#1a1a2e] w-36 shrink-0 truncate">
          {blend.topicLabel}
        </span>
        {/* S1 / S2 stacked bar */}
        <div className="flex-1 h-3 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-[#1a1a2e] transition-all duration-500"
            style={{ width: `${s1Pct}%` }}
          />
          <div
            className="h-full bg-[#ff6b35] transition-all duration-500"
            style={{ width: `${s2Pct}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-500 w-20 text-right shrink-0">
          <span className="font-bold text-[#1a1a2e]">{s1Pct}%</span>
          {" "}structured
        </span>
        <div className="w-14 flex justify-end">
          <DeltaChip delta={blend.delta} />
        </div>
      </div>
      <div className="flex items-center gap-3 pl-36 text-[10px] text-gray-400">
        <span>Default: {defaultS1Pct}% / {100 - defaultS1Pct}%</span>
        <span>·</span>
        <span>Learned: {s1Pct}% structured · {s2Pct}% text</span>
        <span>·</span>
        <span>{blend.reviewCount} reviews</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LearnedWeightsPanel({ propertyId }: { propertyId: string }) {
  const [weights, setWeights] = useState<LearnedWeights | null>(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [showImportance, setShowImportance] = useState(true);
  const [showBlend, setShowBlend] = useState(false);

  async function fetchWeights() {
    setLoading(true);
    try {
      const res = await fetch(`/api/train-weights?propertyId=${encodeURIComponent(propertyId)}`);
      const data = await res.json() as LearnedWeights | { weights: null };
      setWeights("propertyId" in data ? data : null);
    } catch {
      setWeights(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleTrain() {
    setTraining(true);
    try {
      const res = await fetch("/api/train-weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });
      const data = await res.json() as LearnedWeights;
      if (data.propertyId) setWeights(data);
    } catch {
      // keep existing
    } finally {
      setTraining(false);
    }
  }

  useEffect(() => { fetchWeights(); }, [propertyId]);

  // Summary stats
  const movedTopics = weights?.topicImportance.filter((t) => Math.abs(t.delta) >= 0.01).length ?? 0;
  const movedBlends = weights?.sentimentBlend.filter((b) => b.hasStructuredData && Math.abs(b.delta) >= 0.03).length ?? 0;
  const topMover = weights?.topicImportance
    .slice()
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#1a1a2e]" />
          <h2 className="text-lg font-bold text-[#1a1a2e]">Learned Weights</h2>
        </div>
        <button
          onClick={handleTrain}
          disabled={training}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1a2e] text-white hover:bg-[#2d2d4e] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${training ? "animate-spin" : ""}`} />
          {training ? "Training…" : "Train Now"}
        </button>
      </div>
      <p className="text-xs text-gray-400 -mt-2">
        Weights learned from guest rating signals · runs nightly in production
      </p>

      {loading && (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-lg" />)}
        </div>
      )}

      {!loading && !weights && (
        <div className="py-8 text-center border border-dashed border-gray-200 rounded-xl">
          <Brain className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400 mb-3">No training run yet for this property.</p>
          <button
            onClick={handleTrain}
            disabled={training}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#1a1a2e] hover:bg-[#2d2d4e] transition-colors disabled:opacity-50"
          >
            {training ? "Training…" : "Run First Training"}
          </button>
        </div>
      )}

      {!loading && weights && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#faf8f5] rounded-xl p-3 text-center">
              <p className="text-2xl font-extrabold text-[#1a1a2e]">{weights.reviewsUsed}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">reviews used</p>
            </div>
            <div className="bg-[#faf8f5] rounded-xl p-3 text-center">
              <p className="text-2xl font-extrabold text-[#1a1a2e]">{movedTopics}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">topics reweighted</p>
            </div>
            <div className="bg-[#faf8f5] rounded-xl p-3 text-center">
              <p className="text-2xl font-extrabold text-[#1a1a2e]">{movedBlends}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">blends adjusted</p>
            </div>
          </div>

          {/* Top mover callout */}
          {topMover && Math.abs(topMover.delta) >= 0.01 && (
            <div className="rounded-xl px-4 py-3 text-sm"
              style={{ background: topMover.delta > 0 ? "#f0fdf4" : "#fff7ed", borderLeft: `3px solid ${topMover.delta > 0 ? "#22c55e" : "#f97316"}` }}>
              <span className="font-semibold text-[#1a1a2e]">Biggest shift: </span>
              <span className="text-gray-600">{topMover.topicLabel} importance </span>
              <span className="font-semibold" style={{ color: topMover.delta > 0 ? "#16a34a" : "#ea580c" }}>
                {topMover.delta > 0 ? "↑" : "↓"} {Math.abs(Math.round(topMover.delta * 100))}%
              </span>
              <span className="text-gray-500"> from default (r = {topMover.correlation.toFixed(2)})</span>
            </div>
          )}

          {/* Last trained */}
          <p className="text-[11px] text-gray-400">
            Last trained: {formatDate(weights.trainedAt)}
            {weights.previousTrainedAt && (
              <span> · Previous: {formatDate(weights.previousTrainedAt)}</span>
            )}
          </p>

          {/* Topic importance section */}
          <div className="border border-[#e5e0d8] rounded-xl overflow-hidden">
            <button
              onClick={() => setShowImportance((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-[#fafaf9] transition-colors"
            >
              <div>
                <span className="text-sm font-bold text-[#1a1a2e]">Topic Importance Weights</span>
                <span className="ml-2 text-[10px] text-gray-400">
                  how much each topic drives overall satisfaction
                </span>
              </div>
              {showImportance ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {showImportance && (
              <div className="px-4 py-2 bg-white border-t border-[#f0ede8]">
                {/* Legend */}
                <div className="flex items-center gap-4 mb-2 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-gray-300 inline-block" /> default
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-2 rounded-sm bg-emerald-500 inline-block" /> above default
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-2 rounded-sm bg-orange-500 inline-block" /> below default
                  </span>
                </div>

                {weights.topicImportance
                  .slice()
                  .sort((a, b) => b.weight - a.weight)
                  .map((t) => <ImportanceRow key={t.topicId} topic={t} />)
                }
              </div>
            )}
          </div>

          {/* Sentiment blend section */}
          <div className="border border-[#e5e0d8] rounded-xl overflow-hidden">
            <button
              onClick={() => setShowBlend((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-[#fafaf9] transition-colors"
            >
              <div>
                <span className="text-sm font-bold text-[#1a1a2e]">Sentiment Blend Weights</span>
                <span className="ml-2 text-[10px] text-gray-400">
                  structured rating vs text sentiment per topic
                </span>
              </div>
              {showBlend ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {showBlend && (
              <div className="px-4 py-2 bg-white border-t border-[#f0ede8]">
                {/* Legend */}
                <div className="flex items-center gap-4 mb-2 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-2 rounded-sm bg-[#1a1a2e] inline-block" /> structured rating (S1)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-2 rounded-sm bg-[#ff6b35] inline-block" /> text sentiment (S2)
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mb-3">
                  Only topics with Expedia sub-ratings can learn this blend. Others stay at 55% / 45%.
                </p>

                {weights.sentimentBlend
                  .filter((b) => b.hasStructuredData)
                  .map((b) => <BlendRow key={b.topicId} blend={b} />)
                }
              </div>
            )}
          </div>

          {/* Method note */}
          <div className="rounded-xl bg-[#faf8f5] border border-[#e5e0d8] px-4 py-3">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              <span className="font-semibold text-gray-700">How weights are learned:</span>{" "}
              Topic importance uses Pearson correlation between per-topic text sentiment and overall guest rating across all reviews mentioning that topic.
              Sentiment blend uses closed-form OLS to find the structured/text ratio that best predicts overall rating.
              Both apply Bayesian shrinkage — with fewer than ~20 reviews per topic, weights stay close to defaults.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
