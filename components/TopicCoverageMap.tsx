"use client";

import { TopicAnalysis } from "@/lib/analysis";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, Clock, CheckCircle, MinusCircle } from "lucide-react";

interface TopicCoverageMapProps {
  topics: TopicAnalysis[];
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

export default function TopicCoverageMap({ topics }: TopicCoverageMapProps) {
  const relevantTopics = topics.filter((t) => t.isRelevant);
  const irrelevantTopics = topics.filter((t) => !t.isRelevant);

  return (
    <div>
      {/* Grid heatmap */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {relevantTopics.map((topic) => (
          <TopicCell key={topic.topicId} topic={topic} />
        ))}
      </div>

      {/* Not applicable */}
      {irrelevantTopics.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Not applicable to this property
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

function TopicCell({ topic }: { topic: TopicAnalysis }) {
  const bgColor = topic.reviewCount === 0 ? "#fef2f2" : topic.gap === "none" ? "#f0fdf4" : "#fffbeb";
  const borderColor = topic.reviewCount === 0 ? "#fecaca" : topic.gap === "none" ? "#bbf7d0" : "#fde68a";

  return (
    <div
      className="rounded-xl p-3 border"
      style={{ background: bgColor, borderColor }}
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <span className="text-sm font-semibold text-[#1a1a2e] leading-tight">{topic.topicLabel}</span>
        <GapIcon gap={topic.gap} />
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
    </div>
  );
}
