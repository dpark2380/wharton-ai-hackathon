"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, Cpu, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import type { MLAnalysis, MLTopicResult } from "@/lib/ml/analyze-ml";

// ── Score comparison bar ───────────────────────────────────────────────────────

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-bold" style={{ color }}>{score}/100</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Sentiment pill ─────────────────────────────────────────────────────────────

function SentimentPill({ sentiment, score }: { sentiment: string; score: number }) {
  const pct = Math.round(score * 100);
  const config: Record<string, { bg: string; text: string }> = {
    positive: { bg: "#f0fdf4", text: "#16a34a" },
    neutral:  { bg: "#f9fafb", text: "#6b7280" },
    negative: { bg: "#fef2f2", text: "#dc2626" },
    unknown:  { bg: "#f9fafb", text: "#9ca3af" },
  };
  const c = config[sentiment] ?? config.unknown;
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.text }}
    >
      {sentiment} · {pct}%
    </span>
  );
}

// ── Delta indicator ────────────────────────────────────────────────────────────

function Delta({ value }: { value: number }) {
  const abs = Math.abs(value);
  const pct = Math.round(abs * 100);
  if (pct < 2) return <Minus className="w-3 h-3 text-gray-400" />;
  if (value > 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-green-600">
      <TrendingUp className="w-3 h-3" /> +{pct}%
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-500">
      <TrendingDown className="w-3 h-3" /> -{pct}%
    </span>
  );
}

// ── Topic row ──────────────────────────────────────────────────────────────────

function TopicRow({ topic }: { topic: MLTopicResult }) {
  const [open, setOpen] = useState(false);
  const hasChanges = topic.newlyFoundCount > 0 || topic.missedCount > 0 || Math.abs(topic.sentimentDelta) > 0.05;

  return (
    <div className="border-b border-[#f0ede8] last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-[#fafaf9] transition-colors"
      >
        {/* Topic label */}
        <span className="text-sm font-semibold text-[#1a1a2e] w-36 flex-shrink-0">{topic.topicLabel}</span>

        {/* Classification comparison */}
        <span className="text-xs text-gray-400 w-24 flex-shrink-0">
          <span className="text-gray-500 font-medium">{topic.keywordReviewCount}</span>
          <span className="text-gray-300 mx-1">→</span>
          <span className="font-semibold text-[#1a1a2e]">{topic.mlReviewCount}</span>
          <span className="text-gray-400 ml-1">reviews</span>
        </span>

        {/* Newly found badge */}
        {topic.newlyFoundCount > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex-shrink-0">
            +{topic.newlyFoundCount} found
          </span>
        )}

        {/* Sentiment comparison */}
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          <SentimentPill sentiment={topic.mlSentiment} score={topic.mlSentimentScore} />
          <Delta value={topic.sentimentDelta} />
        </div>

        {/* Expand toggle */}
        {hasChanges && (
          <div className="ml-2 flex-shrink-0 text-gray-400">
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        )}
      </button>

      {/* Expanded evidence */}
      {open && (
        <div className="px-5 pb-4 bg-[#fafaf9]">
          {/* Score bars */}
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-[10px] text-gray-400 mb-1.5 uppercase tracking-wide">Keyword sentiment</p>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(topic.keywordSentimentScore * 100)}%`,
                    background: topic.keywordSentimentScore >= 0.6 ? "#22c55e" : topic.keywordSentimentScore <= 0.4 ? "#ef4444" : "#f59e0b",
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">{Math.round(topic.keywordSentimentScore * 100)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-1.5 uppercase tracking-wide">ABSA sentiment</p>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(topic.mlSentimentScore * 100)}%`,
                    background: topic.mlSentimentScore >= 0.6 ? "#22c55e" : topic.mlSentimentScore <= 0.4 ? "#ef4444" : "#f59e0b",
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">{Math.round(topic.mlSentimentScore * 100)}%</p>
            </div>
          </div>

          {/* Evidence quotes */}
          {topic.evidence.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Evidence from reviews</p>
              {topic.evidence.map((e, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 mt-0.5"
                    style={{
                      background: e.sentiment === "positive" ? "#f0fdf4" : e.sentiment === "negative" ? "#fef2f2" : "#f3f4f6",
                      color:      e.sentiment === "positive" ? "#16a34a" : e.sentiment === "negative" ? "#dc2626" : "#6b7280",
                    }}
                  >
                    {e.sentiment}
                  </span>
                  <p className="text-xs text-gray-600 italic">&ldquo;{e.text}&rdquo;</p>
                </div>
              ))}
            </div>
          )}

          {/* Classification diff */}
          {(topic.newlyFoundCount > 0 || topic.missedCount > 0) && (
            <div className="mt-2 pt-2 border-t border-[#e5e0d8]">
              <p className="text-[10px] text-gray-400">
                {topic.newlyFoundCount > 0 && (
                  <span className="text-blue-600 font-semibold">{topic.newlyFoundCount} review{topic.newlyFoundCount !== 1 ? "s" : ""} newly classified by ML</span>
                )}
                {topic.newlyFoundCount > 0 && topic.missedCount > 0 && " · "}
                {topic.missedCount > 0 && (
                  <span className="text-gray-500">{topic.missedCount} keyword false positive{topic.missedCount !== 1 ? "s" : ""} removed</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MLAnalysis({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<MLAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const run = () => {
    setStarted(true);
    setLoading(true);
    setError(null);
    fetch("/api/ml-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId }),
    })
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  if (!started) {
    return (
      <div className="rounded-2xl border border-[#e5e0d8] bg-white p-8 text-center">
        <Cpu className="w-8 h-8 text-[#1a1a2e] mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#1a1a2e] mb-1">ML-Enhanced Analysis</h3>
        <p className="text-sm text-gray-500 mb-1">
          Runs embedding-based topic classification and aspect-based sentiment analysis (ABSA) across your review corpus.
        </p>
        <p className="text-xs text-gray-400 mb-5">
          Analyzes up to 60 reviews · typically takes 15–30 seconds
        </p>
        <button
          onClick={run}
          className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}
        >
          Run ML Analysis
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#e5e0d8] bg-white p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#ff6b35] mx-auto mb-3" />
        <p className="text-sm font-semibold text-[#1a1a2e] mb-1">Running ML pipeline…</p>
        <p className="text-xs text-gray-400">Embedding reviews · classifying topics · running ABSA per aspect</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-600 mb-3">ML analysis failed. Check your OpenAI API key.</p>
        <button onClick={run} className="text-xs font-semibold text-red-700 underline">Try again</button>
      </div>
    );
  }

  const relevantTopics = data.topics.filter((t) => t.isRelevant);
  const changedTopics = relevantTopics.filter(
    (t) => t.newlyFoundCount > 0 || t.missedCount > 0 || Math.abs(t.sentimentDelta) > 0.05
  );

  const scoreColor = (s: number) => s >= 75 ? "#22c55e" : s >= 50 ? "#f59e0b" : "#ef4444";
  const deltaColor = data.scoreDelta > 2 ? "#16a34a" : data.scoreDelta < -2 ? "#dc2626" : "#6b7280";

  return (
    <div className="space-y-5">
      {/* Score comparison header */}
      <div className="rounded-2xl border border-[#e5e0d8] bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-[#1a1a2e]" />
          <h3 className="text-sm font-bold text-[#1a1a2e]">Score Comparison</h3>
          <span className="text-[10px] text-gray-400 ml-1">· {data.reviewsAnalyzed} reviews analyzed</span>
        </div>

        <div className="space-y-3 mb-4">
          <ScoreBar label="Keyword-based score (current)" score={data.keywordHealthScore} color={scoreColor(data.keywordHealthScore)} />
          <ScoreBar label="ML-enhanced score (embedding + ABSA)" score={data.mlHealthScore} color={scoreColor(data.mlHealthScore)} />
        </div>

        <div className="flex items-center gap-4 pt-3 border-t border-[#f0ede8]">
          <div className="text-center">
            <p className="text-xs text-gray-400">Score delta</p>
            <p className="text-lg font-extrabold" style={{ color: deltaColor }}>
              {data.scoreDelta > 0 ? "+" : ""}{data.scoreDelta}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Topics reclassified</p>
            <p className="text-lg font-extrabold text-blue-600">{data.reclassifiedCount}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Sentiment corrections</p>
            <p className="text-lg font-extrabold text-amber-600">{data.sentimentCorrected}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] text-gray-400">Computed</p>
            <p className="text-[10px] text-gray-500">{new Date(data.computedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        </div>
      </div>

      {/* Per-topic table */}
      <div className="rounded-2xl border border-[#e5e0d8] bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e5e0d8] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1a1a2e]">Per-topic Breakdown</h3>
          {changedTopics.length > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
              {changedTopics.length} topic{changedTopics.length !== 1 ? "s" : ""} changed · click to expand
            </span>
          )}
        </div>
        <div className="px-5 py-2 border-b border-[#f0ede8] flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-36">Topic</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-24">Reviews</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 ml-auto">ABSA Sentiment</span>
        </div>
        {relevantTopics.map((topic) => (
          <TopicRow key={topic.topicId} topic={topic} />
        ))}
      </div>

      {/* Method note */}
      <div className="rounded-xl bg-[#faf8f5] border border-[#e5e0d8] px-4 py-3">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          <span className="font-semibold text-gray-700">How this works:</span> Review texts are embedded using OpenAI <code className="text-[10px] bg-white border border-gray-200 rounded px-1">text-embedding-3-small</code> and compared via cosine similarity to semantic topic descriptions, replacing keyword matching. Sentiment is computed with aspect-based sentiment analysis (ABSA) using GPT-4o-mini with structured prompting, giving per-review, per-topic scores instead of aggregate word counts. Negation (&quot;not dirty&quot;) and paraphrasing (&quot;lumpy mattress&quot;) are handled correctly.
        </p>
      </div>
    </div>
  );
}
