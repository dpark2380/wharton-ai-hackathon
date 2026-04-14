"use client";

import { useRouter } from "next/navigation";
import KnowledgeHealthScore from "./KnowledgeHealthScore";
import { MapPin, Star, MessageSquare, TrendingUp } from "lucide-react";

interface TopGap {
  topicId: string;
  topicLabel: string;
  gap: string;
  reviewCount: number;
  freshnessDays: number | null;
}

type UrgencyTier = "critical" | "urgent" | "monitor" | "low";

function getUrgencyTier(gap: TopGap): UrgencyTier {
  if (gap.reviewCount === 0) return "critical";
  if (gap.freshnessDays !== null && gap.freshnessDays > 365) return "urgent";
  if (gap.freshnessDays !== null && gap.freshnessDays > 180) return "monitor";
  return "low";
}

function getUrgencyLabel(gap: TopGap): string {
  if (gap.reviewCount === 0) return "Never reviewed";
  if (gap.freshnessDays !== null) {
    const months = Math.round(gap.freshnessDays / 30);
    return `${months}mo old`;
  }
  return "Sparse coverage";
}

const URGENCY_STYLE: Record<UrgencyTier, { label: string; color: string; bg: string; border: string; dot: string }> = {
  critical: { label: "CRITICAL", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "#dc2626" },
  urgent:   { label: "URGENT",   color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", dot: "#ea580c" },
  monitor:  { label: "MONITOR",  color: "#ca8a04", bg: "#fefce8", border: "#fef08a", dot: "#ca8a04" },
  low:      { label: "LOW",      color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", dot: "#2563eb" },
};

interface PropertyCardProps {
  id: string;
  city: string;
  country: string;
  province?: string;
  star_rating: number;
  guestrating_avg_expedia: number;
  popular_amenities_list: string[];
  property_description: string;
  knowledgeHealthScore: number;
  totalReviews: number;
  topGaps: TopGap[];
  topTopics: { topicLabel: string; coverageScore: number; sentiment: string }[];
  index: number;
}


function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`}
        />
      ))}
    </div>
  );
}

function SentimentDot({ sentiment }: { sentiment: string }) {
  const colors: Record<string, string> = {
    positive: "#22c55e",
    negative: "#ef4444",
    mixed: "#f59e0b",
    unknown: "#cbd5e1",
  };
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: colors[sentiment] || "#cbd5e1" }}
    />
  );
}

function getHealthBgColor(score: number) {
  if (score >= 75) return "bg-green-50 border-green-200";
  if (score >= 50) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

export default function PropertyCard({
  id,
  city,
  country,
  province,
  star_rating,
  guestrating_avg_expedia,
  popular_amenities_list,
  property_description,
  knowledgeHealthScore,
  totalReviews,
  topGaps,
  topTopics,
  index,
}: PropertyCardProps) {
  const router = useRouter();

  // Helper to capitalize words (e.g., "new york" -> "New York")
  const toTitleCase = (str: string) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Helper to capitalize just the first letter (e.g., for descriptions)
  const capitalizeFirst = (str: string) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const rawLocation = [city, province, country].filter(Boolean).join(", ");
  const location = toTitleCase(rawLocation);

  const shortDesc = capitalizeFirst(
    property_description
      .replace(/\|MASK\|/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  ).slice(0, 100);

  const topAmenities = popular_amenities_list.slice(0, 6);

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-[#e5e0d8] p-5 cursor-pointer card-hover animate-fade-in-up stagger-${Math.min(
        index + 1,
        6
      )}`}
      onClick={() => router.push(`/property/${id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StarRating rating={star_rating} />
            {star_rating > 0 && (
              <span className="text-xs text-gray-400">{star_rating}★</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        </div>
        <KnowledgeHealthScore score={knowledgeHealthScore} size="sm" showLabel />
      </div>

      {/* Description preview */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{shortDesc}...</p>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">{totalReviews}</span>
          <span className="text-xs text-gray-400">reviews</span>
        </div>
        {guestrating_avg_expedia > 0 && (
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-[#ff6b35]" />
            <span className="text-sm font-medium" style={{ color: "#ff6b35" }}>
              {guestrating_avg_expedia.toFixed(1)}
            </span>
            <span className="text-xs text-gray-400">/ 10</span>
          </div>
        )}
      </div>

      {/* Amenities */}
      {topAmenities.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {topAmenities.map((amenity) => (
            <span
              key={amenity}
              className="inline-flex items-center gap-1 text-xs bg-[#f0ede8] text-gray-600 px-2 py-0.5 rounded-full"
            >
              {toTitleCase(amenity.replace(/_/g, " "))}
            </span>
          ))}
        </div>
      )}

      {/* Coverage mini-map */}
      {topTopics.length > 0 && (
        <div className="border-t border-[#f0ede8] pt-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Topic Coverage
          </p>
          <div className="space-y-1.5">
            {topTopics.slice(0, 3).map((t) => (
              <div key={t.topicLabel} className="flex items-center gap-2">
                <SentimentDot sentiment={t.sentiment} />
                <span className="text-xs text-gray-600 w-24 truncate">
                  {toTitleCase(t.topicLabel)}
                </span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.round(t.coverageScore * 100)}%`,
                      background:
                        t.sentiment === "positive"
                          ? "#22c55e"
                          : t.sentiment === "negative"
                          ? "#ef4444"
                          : "#f59e0b",
                    }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right">
                  {Math.round(t.coverageScore * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gap urgency badges */}
      {topGaps.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {topGaps.slice(0, 2).map((gap) => {
            const tier = getUrgencyTier(gap);
            const style = URGENCY_STYLE[tier];
            return (
              <span
                key={gap.topicId}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border"
                style={{ color: style.color, background: style.bg, borderColor: style.border }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: style.dot }} />
                <span>{style.label}:</span>
                <span className="font-medium">{toTitleCase(gap.topicLabel)}</span>
                <span className="font-normal opacity-75">· {getUrgencyLabel(gap)}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* CTA */}
      <div className="mt-4 pointer-events-none">
        <div
          className="w-full text-sm font-semibold py-2 rounded-xl text-white text-center transition-all duration-200"
          style={{ background: "linear-gradient(135deg, #ff6b35, #f59e0b)" }}
        >
          View &amp; Review →
        </div>
      </div>
    </div>
  );
}