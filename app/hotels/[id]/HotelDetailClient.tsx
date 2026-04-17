"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { MapPin, Star, ArrowLeft, ArrowRight, Clock, PawPrint, MessageSquare, ChevronDown } from "lucide-react";
import GlobalNav from "@/components/GlobalNav";
import { checkTextQuality } from "@/lib/quality";

export interface ReviewItem {
  id: string;
  reviewerName: string;
  reviewerInitial: string;
  isAnonymous: boolean;
  date: string;
  starsOutOf5: number;
  title: string;
  text: string;
  topics: string[];
  isLive: boolean;
}

export interface PropertyDetail {
  id: string;
  name: string;
  city: string;
  country: string;
  province: string;
  starRating: number;
  guestRating: number;
  description: string;
  amenityGroups: { label: string; items: string[] }[];
  checkIn: string;
  checkOut: string;
  petPolicy: string;
  totalReviews: number;
}

// Topic label mapping
const TOPIC_LABELS: Record<string, string> = {
  cleanliness: "Cleanliness",
  location: "Location",
  food_breakfast: "Food & Breakfast",
  wifi_internet: "WiFi",
  parking: "Parking",
  pool_fitness: "Pool & Fitness",
  checkin_checkout: "Check-in",
  noise: "Noise",
  room_comfort: "Room Comfort",
  bathroom: "Bathroom",
  staff_service: "Staff",
  value: "Value",
  spa_wellness: "Spa",
  accessibility: "Accessibility",
  eco_sustainability: "Eco",
};

const TOPIC_COLORS: Record<string, { bg: string; text: string }> = {
  cleanliness:      { bg: "#EFF6FF", text: "#2563EB" },
  location:         { bg: "#F0FDF4", text: "#16A34A" },
  food_breakfast:   { bg: "#FFF7ED", text: "#C2410C" },
  wifi_internet:    { bg: "#F5F3FF", text: "#7C3AED" },
  parking:          { bg: "#F9FAFB", text: "#4B5563" },
  pool_fitness:     { bg: "#ECFDF5", text: "#059669" },
  checkin_checkout: { bg: "#EFF6FF", text: "#1D4ED8" },
  noise:            { bg: "#FFF7ED", text: "#EA580C" },
  room_comfort:     { bg: "#FDF4FF", text: "#A21CAF" },
  bathroom:         { bg: "#EFF6FF", text: "#0369A1" },
  staff_service:    { bg: "#FFFBEB", text: "#B45309" },
  value:            { bg: "#F0FDF4", text: "#15803D" },
  spa_wellness:     { bg: "#FDF4FF", text: "#9333EA" },
  accessibility:    { bg: "#F9FAFB", text: "#374151" },
  eco_sustainability: { bg: "#F0FDF4", text: "#166534" },
};

function sentenceCase(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toTitleCase(text: string): string {
  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function StarRow({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < Math.round(n) ? "fill-[#FFC72C] text-[#FFC72C]" : "fill-gray-200 text-gray-200"}`}
        />
      ))}
    </div>
  );
}

function TopicBadge({ topicId }: { topicId: string }) {
  const label = TOPIC_LABELS[topicId] || topicId;
  const color = TOPIC_COLORS[topicId] ?? { bg: "#F3F4F6", text: "#6B7280" };
  return (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: color.bg, color: color.text }}
    >
      {label}
    </span>
  );
}

function ReviewCard({ review }: { review: ReviewItem }) {
  const [expanded, setExpanded] = useState(false);
  const maxLen = 180;
  const needsTruncate = review.text.length > maxLen;
  const displayText = expanded || !needsTruncate ? review.text : review.text.slice(0, maxLen) + "…";

  const avatarStyle = review.isLive
    ? { background: "linear-gradient(135deg, #003580, #006FCF)" }
    : { background: "linear-gradient(135deg, #6B7280, #9CA3AF)" };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0 select-none"
          style={avatarStyle}
        >
          {review.reviewerInitial}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">
                {review.isAnonymous ? "Anonymous Guest" : review.reviewerName}
              </p>
              <p className="text-[10px] text-gray-400">{review.date}</p>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <StarRow n={review.starsOutOf5} />
              {review.isLive && (
                <span className="text-[9px] font-bold text-[#003580] bg-[#EFF6FF] px-1.5 py-0.5 rounded-full">
                  LIVE
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          {review.title && (
            <p className="text-xs font-semibold text-gray-700 mb-1">{sentenceCase(review.title)}</p>
          )}

          {/* Text */}
          {review.text && (
            <div>
              <p className="text-xs text-gray-600 leading-relaxed">{sentenceCase(displayText)}</p>
              {needsTruncate && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-[10px] text-[#003580] font-medium mt-0.5 hover:underline"
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}

          {/* Topics */}
          {review.topics.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {review.topics.slice(0, 5).map((t) => (
                <TopicBadge key={t} topicId={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AmenityPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center text-xs bg-gray-50 text-gray-600 px-2.5 py-1 rounded-full border border-gray-100">
      {toTitleCase(label)}
    </span>
  );
}

// ── Styled select helper ──────────────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:border-[#003580] cursor-pointer transition-colors"
      >
        {children}
      </select>
      <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

interface HotelDetailClientProps {
  detail: PropertyDetail;
  reviews: ReviewItem[];
}

export default function HotelDetailClient({ detail, reviews }: HotelDetailClientProps) {
  const [sortBy, setSortBy] = useState<"recent" | "highest" | "lowest">("recent");
  const [topicFilter, setTopicFilter] = useState("all");
  const [qualityFilter, setQualityFilter] = useState<"all" | "high" | "medium" | "low">("all");

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.starsOutOf5, 0) / reviews.length).toFixed(1)
    : null;

  // Pre-compute quality scores once
  const qualityScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reviews) {
      map.set(r.id, checkTextQuality(r.text).score);
    }
    return map;
  }, [reviews]);

  // Collect unique topics across all reviews
  const allTopics = useMemo(
    () => Array.from(new Set(reviews.flatMap((r) => r.topics))).sort(),
    [reviews]
  );

  // Filter then sort
  const displayed = useMemo(() => {
    let result = reviews.filter((r) => {
      if (topicFilter !== "all" && !r.topics.includes(topicFilter)) return false;
      if (qualityFilter !== "all") {
        const score = qualityScores.get(r.id) ?? 0;
        if (qualityFilter === "high" && score < 0.7) return false;
        if (qualityFilter === "medium" && (score < 0.4 || score >= 0.7)) return false;
        if (qualityFilter === "low" && score >= 0.4) return false;
      }
      return true;
    });

    if (sortBy === "highest") result = [...result].sort((a, b) => b.starsOutOf5 - a.starsOutOf5);
    else if (sortBy === "lowest") result = [...result].sort((a, b) => a.starsOutOf5 - b.starsOutOf5);
    // "recent" = default server order (already most recent first)

    return result;
  }, [reviews, topicFilter, qualityFilter, sortBy, qualityScores]);

  return (
    <div className="min-h-screen bg-gray-50">
      <GlobalNav />

      {/* Property header banner */}
      <div style={{ background: "linear-gradient(135deg, #001f4d 0%, #003580 60%, #005bb5 100%)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white/80 transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Hotels
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              {detail.starRating > 0 && (
                <div className="flex items-center gap-0.5 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i < detail.starRating ? "fill-[#FFC72C] text-[#FFC72C]" : "fill-white/20 text-white/20"}`}
                    />
                  ))}
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">{detail.name}</h1>
              <div className="flex items-center gap-1.5 text-white/60 text-sm mt-1">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{[detail.city, detail.province, detail.country].filter(Boolean).join(", ")}</span>
              </div>
            </div>

            {/* Review CTA */}
            <Link
              href={`/review/${detail.id}`}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-[#1E243A] hover:brightness-105 transition-all"
              style={{ background: "#FFC72C" }}
            >
              Write a Review
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* LEFT: Reviews */}
          <div className="flex-1 min-w-0">
            {/* Header + filters */}
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  <h2 className="font-bold text-gray-900 text-base">
                    Guest Reviews
                    <span className="text-gray-400 font-normal text-sm ml-1.5">
                      ({displayed.length}{displayed.length !== reviews.length ? ` of ${reviews.length}` : ""})
                    </span>
                  </h2>
                </div>
                {avgRating && (
                  <div className="flex items-center gap-1.5">
                    <StarRow n={parseFloat(avgRating)} />
                    <span className="text-sm font-bold text-gray-900">{avgRating}</span>
                    <span className="text-xs text-gray-400">/ 5</span>
                  </div>
                )}
              </div>

              {/* Filter bar */}
              {reviews.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <FilterSelect value={sortBy} onChange={(v) => setSortBy(v as typeof sortBy)}>
                    <option value="recent">Most Recent</option>
                    <option value="highest">Highest Rated</option>
                    <option value="lowest">Lowest Rated</option>
                  </FilterSelect>

                  {allTopics.length > 0 && (
                    <FilterSelect value={topicFilter} onChange={setTopicFilter}>
                      <option value="all">All Topics</option>
                      {allTopics.map((t) => (
                        <option key={t} value={t}>{TOPIC_LABELS[t] ?? t}</option>
                      ))}
                    </FilterSelect>
                  )}

                  <FilterSelect value={qualityFilter} onChange={(v) => setQualityFilter(v as typeof qualityFilter)}>
                    <option value="all">Any Quality</option>
                    <option value="high">High Quality</option>
                    <option value="medium">Medium Quality</option>
                    <option value="low">Short / Low Detail</option>
                  </FilterSelect>

                  {(sortBy !== "recent" || topicFilter !== "all" || qualityFilter !== "all") && (
                    <button
                      onClick={() => { setSortBy("recent"); setTopicFilter("all"); setQualityFilter("all"); }}
                      className="text-[11px] text-gray-400 hover:text-gray-600 underline transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {reviews.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No reviews yet. Be the first!</p>
                <Link
                  href={`/review/${detail.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm text-[#003580] font-semibold hover:underline"
                >
                  Write a Review <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : displayed.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
                <p className="text-sm font-medium">No reviews match these filters</p>
                <button
                  onClick={() => { setSortBy("recent"); setTopicFilter("all"); setQualityFilter("all"); }}
                  className="mt-2 text-sm text-[#003580] font-semibold hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {displayed.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Property details */}
          <div className="lg:w-80 xl:w-96 flex-shrink-0 space-y-4">

            {/* Ratings card */}
            {detail.guestRating > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Ratings</h3>
                <div className="flex items-center gap-3">
                  <div
                    className="text-3xl font-black leading-none"
                    style={{ color: "#003580" }}
                  >
                    {detail.guestRating.toFixed(1)}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Expedia Guest Rating</p>
                    <p className="text-[10px] text-gray-400">out of 10</p>
                  </div>
                </div>
              </div>
            )}

            {/* About */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">About</h3>
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-6">
                {sentenceCase(detail.description) || "No description available."}
              </p>
            </div>

            {/* Check-in / out */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Stay Details</h3>
              <div className="space-y-2">
                {detail.checkIn && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-400">Check-in:</span>
                    <span className="font-medium">{detail.checkIn}</span>
                  </div>
                )}
                {detail.checkOut && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-400">Check-out:</span>
                    <span className="font-medium">{detail.checkOut}</span>
                  </div>
                )}
                {detail.petPolicy && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <PawPrint className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="font-medium">{detail.petPolicy}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Amenities */}
            {detail.amenityGroups.map((group) => (
              <div key={group.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{group.label}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((item) => (
                    <AmenityPill key={item} label={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
