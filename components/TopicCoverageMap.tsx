"use client";

import { useState } from "react";
import { TopicAnalysis } from "@/lib/analysis";
import { Review } from "@/lib/data";
import { classifyText } from "@/lib/topics";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, Clock, CheckCircle, MinusCircle, X, ChevronDown, Loader2 } from "lucide-react";

// ── Per-review sentiment (client-safe keyword approach) ───────────────────────
const POS_WORDS = ["great", "excellent", "amazing", "wonderful", "fantastic", "loved", "perfect",
  "good", "nice", "lovely", "outstanding", "superb", "best", "clean", "comfortable",
  "helpful", "friendly", "beautiful", "delicious", "spacious", "modern", "recommend"];
const NEG_WORDS = ["bad", "poor", "terrible", "awful", "horrible", "worst", "dirty", "rude",
  "disappointing", "disgusting", "broken", "noisy", "stained", "cold", "slow",
  "unfriendly", "unhelpful", "cramped", "outdated", "overpriced", "smelly", "avoid"];

type ReviewSentiment = "positive" | "neutral" | "negative";

function getReviewSentiment(review: Review): ReviewSentiment {
  const text = (review.review_text || "").toLowerCase();
  let pos = 0, neg = 0;
  for (const w of POS_WORDS) if (text.includes(w)) pos++;
  for (const w of NEG_WORDS) if (text.includes(w)) neg++;
  if (pos === 0 && neg === 0) return "neutral";
  if (pos > neg * 1.5) return "positive";
  if (neg > pos * 1.5) return "negative";
  return "neutral";
}

type SentimentFilter = "all" | "positive" | "neutral" | "negative";

function ReviewSentimentBadge({ sentiment }: { sentiment: ReviewSentiment }) {
  const config: Record<ReviewSentiment, { label: string; bg: string; text: string }> = {
    positive: { label: "Positive", bg: "#f0fdf4", text: "#16a34a" },
    neutral:  { label: "Neutral",  bg: "#f9fafb", text: "#6b7280" },
    negative: { label: "Negative", bg: "#fef2f2", text: "#dc2626" },
  };
  const c = config[sentiment];
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

interface TopicCoverageMapProps {
  topics: TopicAnalysis[];
  reviews?: Review[];
  propertyId?: string;
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const config = {
    positive: { label: "Positive", class: "bg-green-100 text-green-700 border-green-200" },
    negative: { label: "Negative", class: "bg-red-100 text-red-700 border-red-200" },
    mixed: { label: "Mixed", class: "bg-amber-100 text-amber-700 border-amber-200" },
    unknown: { label: "No data", class: "bg-gray-100 text-gray-500 border-gray-200" },
  };
  const c = config[sentiment as keyof typeof config] || config.unknown;
  return (
    <Badge variant="outline" className={`text-xs ${c.class}`}>
      {c.label}
    </Badge>
  );
}

function GapIcon({ gap }: { gap: string }) {
  if (gap === "high") return <AlertTriangle className="w-4 h-4 text-red-500" />;
  if (gap === "medium") return <Clock className="w-4 h-4 text-amber-500" />;
  if (gap === "low") return <MinusCircle className="w-4 h-4 text-blue-400" />;
  return <CheckCircle className="w-4 h-4 text-green-500" />;
}

function coverageColor(score: number): string {
  if (score >= 0.7) return "#22c55e";
  if (score >= 0.4) return "#f59e0b";
  if (score > 0) return "#ef4444";
  return "#e5e0d8";
}

export default function TopicCoverageMap({ topics, reviews = [], propertyId }: TopicCoverageMapProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [topicInsights, setTopicInsights] = useState<Record<string, string>>({});
  const [topicInsightsLoading, setTopicInsightsLoading] = useState<Record<string, boolean>>({});
  const relevantTopics = topics.filter((t) => t.isRelevant);
  const irrelevantTopics = topics.filter((t) => !t.isRelevant);

  const selectedTopic = relevantTopics.find((t) => t.topicId === selectedTopicId) ?? null;

  // Find reviews that mention the selected topic, annotated with per-review sentiment
  const allTopicReviews = selectedTopicId
    ? reviews
        .filter((r) => {
          if (!r.review_text?.trim()) return false;
          return classifyText(r.review_text).has(selectedTopicId);
        })
        .map((r) => ({ review: r, sentiment: getReviewSentiment(r) }))
    : [];

  const filteredTopicReviews = sentimentFilter === "all"
    ? allTopicReviews
    : allTopicReviews.filter((r) => r.sentiment === sentimentFilter);

  const displayedReviews = filteredTopicReviews.slice(0, 10);

  // Counts per sentiment bucket for filter pill labels
  const counts = {
    positive: allTopicReviews.filter((r) => r.sentiment === "positive").length,
    neutral:  allTopicReviews.filter((r) => r.sentiment === "neutral").length,
    negative: allTopicReviews.filter((r) => r.sentiment === "negative").length,
  };

  const handleSelect = (topicId: string) => {
    setSelectedTopicId((prev) => {
      if (prev === topicId) return null;
      setSentimentFilter("all"); // reset filter on topic change

      // Fetch topic-level insight if we have a propertyId and haven't loaded it yet
      if (propertyId && !topicInsights[topicId] && !topicInsightsLoading[topicId]) {
        const topic = topics.find((t) => t.topicId === topicId);
        setTopicInsightsLoading((l) => ({ ...l, [topicId]: true }));
        fetch("/api/generate-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId, topicId, topicLabel: topic?.topicLabel }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.summary) {
              setTopicInsights((prev) => ({ ...prev, [topicId]: d.summary }));
            }
          })
          .catch(() => {})
          .finally(() => setTopicInsightsLoading((l) => ({ ...l, [topicId]: false })));
      }

      return topicId;
    });
  };

  return (
    <div>
      {/* Grid heatmap */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {relevantTopics.map((topic) => (
          <TopicCell
            key={topic.topicId}
            topic={topic}
            isSelected={selectedTopicId === topic.topicId}
            onClick={() => handleSelect(topic.topicId)}
          />
        ))}
      </div>

      {/* Expanded review panel */}
      {selectedTopic && (
        <div className="mb-6 bg-white rounded-2xl border border-[#e5e0d8] overflow-hidden">
          {/* Panel header */}
          <div className="px-5 py-3 border-b border-[#e5e0d8]">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <GapIcon gap={selectedTopic.gap} />
                <span className="text-sm font-bold text-[#1a1a2e]">{selectedTopic.topicLabel}</span>
                <span className="text-xs text-gray-400">
                  {allTopicReviews.length} {allTopicReviews.length === 1 ? "review" : "reviews"}
                </span>
              </div>
              <button
                onClick={() => setSelectedTopicId(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Topic AI insight */}
            {propertyId && (topicInsightsLoading[selectedTopicId!] || topicInsights[selectedTopicId!]) && (
              <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-1">AI Insight</p>
                {topicInsightsLoading[selectedTopicId!] ? (
                  <div className="flex items-center gap-2 text-xs text-amber-700">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Analysing reviews...
                  </div>
                ) : (
                  <p className="text-sm text-amber-900 leading-relaxed">{topicInsights[selectedTopicId!]}</p>
                )}
              </div>
            )}

            {/* Sentiment filter pills */}
            {allTopicReviews.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {(["all", "positive", "neutral", "negative"] as const).map((f) => {
                  const label = f === "all"
                    ? `All (${allTopicReviews.length})`
                    : f === "positive" ? `Positive (${counts.positive})`
                    : f === "neutral"  ? `Neutral (${counts.neutral})`
                    : `Negative (${counts.negative})`;
                  const activeColors: Record<string, { bg: string; text: string; border: string }> = {
                    all:      { bg: "#1a1a2e", text: "white",   border: "#1a1a2e" },
                    positive: { bg: "#f0fdf4", text: "#16a34a", border: "#86efac" },
                    neutral:  { bg: "#f3f4f6", text: "#4b5563", border: "#d1d5db" },
                    negative: { bg: "#fef2f2", text: "#dc2626", border: "#fca5a5" },
                  };
                  const active = sentimentFilter === f;
                  const c = activeColors[f];
                  return (
                    <button
                      key={f}
                      onClick={() => setSentimentFilter(f)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all duration-150"
                      style={active
                        ? { background: c.bg, color: c.text, borderColor: c.border }
                        : { background: "white", color: "#9ca3af", borderColor: "#e5e7eb" }
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {allTopicReviews.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-gray-400">No reviews mention this topic yet.</p>
              <p className="text-xs text-gray-300 mt-1">This is a knowledge gap — prompt travelers to share their experience.</p>
            </div>
          ) : displayedReviews.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-gray-400">No {sentimentFilter} reviews for this topic.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#f0ede8]">
              {displayedReviews.map(({ review: r, sentiment }, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-400">
                      {r.acquisition_date} · {r.rating.overall > 0 ? `${r.rating.overall}/5` : ""}
                    </span>
                    <ReviewSentimentBadge sentiment={sentiment} />
                  </div>
                  {r.review_title && (
                    <p className="text-xs font-semibold text-[#1a1a2e] mb-0.5">{r.review_title}</p>
                  )}
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{r.review_text}</p>
                </div>
              ))}
              {filteredTopicReviews.length > 10 && (
                <div className="px-5 py-3 text-center">
                  <p className="text-xs text-gray-400">Showing 10 of {filteredTopicReviews.length} reviews</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Not applicable */}
      {irrelevantTopics.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
            Not tracked for this property
          </p>
          <p className="text-xs text-gray-400 mb-2">
            These topics are skipped because this property does not advertise the relevant amenity or service (e.g. no spa, no pool, no eco certification). Collecting reviews on features a hotel doesn&apos;t offer would mislead future guests.
          </p>
          <div className="flex flex-wrap gap-2">
            {irrelevantTopics.map((t) => (
              <Badge key={t.topicId} variant="outline" className="text-xs text-gray-400 border-gray-200">
                {t.topicLabel}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


function TopicCell({
  topic,
  isSelected,
  onClick,
}: {
  topic: TopicAnalysis;
  isSelected: boolean;
  onClick: () => void;
}) {
  const bgColor = isSelected
    ? "#eff6ff"
    : topic.reviewCount === 0
    ? "#fef2f2"
    : topic.gap === "none"
    ? "#f0fdf4"
    : "#fffbeb";

  const borderColor = isSelected
    ? "#3b82f6"
    : topic.reviewCount === 0
    ? "#fecaca"
    : topic.gap === "none"
    ? "#bbf7d0"
    : "#fde68a";

  return (
    <button
      onClick={onClick}
      className="rounded-xl p-3 border text-left w-full transition-all hover:shadow-sm hover:scale-[1.01] active:scale-[0.99]"
      style={{ background: bgColor, borderColor }}
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <span className="text-sm font-semibold text-[#1a1a2e] leading-tight">{topic.topicLabel}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <GapIcon gap={topic.gap} />
          <ChevronDown
            className={`w-3 h-3 text-gray-400 transition-transform ${isSelected ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* Coverage bar */}
      <div className="h-1.5 bg-white rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.round(topic.coverageScore * 100)}%`,
            background: coverageColor(topic.coverageScore),
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {topic.reviewCount} {topic.reviewCount === 1 ? "mention" : "mentions"}
        </span>
        <SentimentBadge sentiment={topic.sentiment} />
      </div>

      {topic.isStale && (
        <div className="mt-1.5 flex items-center gap-1">
          <TrendingDown className="w-3 h-3 text-amber-500" />
          <span className="text-xs text-amber-600">
            Stale ({topic.freshnessDays}d ago)
          </span>
        </div>
      )}

      {topic.hasSentimentShift && (
        <div className="mt-1.5">
          <Badge variant="outline" className="text-xs border-red-300 text-red-600 bg-red-50">
            Sentiment shift
          </Badge>
        </div>
      )}

      {topic.lastMentionDate && !topic.isStale && (
        <div className="mt-1 text-xs text-gray-400">
          Last: {new Date(topic.lastMentionDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
        </div>
      )}
    </button>
  );
}
