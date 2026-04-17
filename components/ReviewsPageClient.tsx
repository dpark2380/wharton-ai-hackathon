"use client";

import { useState } from "react";
import { Star, MessageSquare, Zap } from "lucide-react";
import LiveReviewsFeed, { LiveReviewEvent } from "./LiveReviewsFeed";

export interface HistoricalReview {
  id: string;
  date: string;
  overallRating: number;
  title: string;
  text: string;
}

function StarRow({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(n) ? "fill-amber-400 text-amber-400" : "fill-gray-100 text-gray-100"}`} />
      ))}
    </div>
  );
}

function HistoricalReviewCard({ review }: { review: HistoricalReview }) {
  const [expanded, setExpanded] = useState(false);
  const maxLen = 200;
  const needsTruncate = review.text.length > maxLen;
  const display = expanded || !needsTruncate ? review.text : review.text.slice(0, maxLen) + "…";

  return (
    <div className="p-5 border-b border-[#E4E7EF] last:border-0">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-400">
            G
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1E243A]">Guest</p>
            <p className="text-xs text-gray-400">{review.date}</p>
          </div>
        </div>
        <StarRow n={review.overallRating} />
      </div>
      {review.title && (
        <p className="text-sm font-semibold text-gray-700 mb-1">
          {review.title.charAt(0).toUpperCase() + review.title.slice(1)}
        </p>
      )}
      {review.text && (
        <div>
          <p className="text-sm text-gray-600 leading-relaxed">
            {display.charAt(0).toUpperCase() + display.slice(1)}
          </p>
          {needsTruncate && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-[#003580] font-medium mt-1 hover:underline"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  allReviews: HistoricalReview[];
  recentEvents: LiveReviewEvent[];
}

type Tab = "all" | "recent";

export default function ReviewsPageClient({ allReviews, recentEvents }: Props) {
  const [tab, setTab] = useState<Tab>("recent");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-[#1E243A]">Reviews</h2>
        <p className="text-sm text-gray-500 mt-1">Browse all guest feedback for this property.</p>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("recent")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={tab === "recent"
            ? { background: "#003580", color: "white" }
            : { background: "white", color: "#6B7280", border: "1px solid #E4E7EF" }}
        >
          <Zap className="w-4 h-4" />
          Recent Reviews
          {recentEvents.length > 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
              style={tab === "recent" ? { background: "rgba(255,255,255,0.2)", color: "white" } : { background: "#FFF8E1", color: "#B8860B" }}>
              {recentEvents.length} live
            </span>
          )}
        </button>

        <button
          onClick={() => setTab("all")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={tab === "all"
            ? { background: "#003580", color: "white" }
            : { background: "white", color: "#6B7280", border: "1px solid #E4E7EF" }}
        >
          <MessageSquare className="w-4 h-4" />
          All Reviews
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
            style={tab === "all" ? { background: "rgba(255,255,255,0.2)", color: "white" } : { background: "#F3F4F6", color: "#6B7280" }}>
            {allReviews.length}
          </span>
        </button>
      </div>

      {/* Content */}
      {tab === "all" ? (
        allReviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E4E7EF] p-10 text-center">
            <p className="text-gray-400 text-sm">No reviews found for this property.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E4E7EF] divide-y divide-[#E4E7EF] overflow-hidden">
            {allReviews.map((r) => (
              <HistoricalReviewCard key={r.id} review={r} />
            ))}
          </div>
        )
      ) : (
        recentEvents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E4E7EF] p-10 text-center">
            <p className="text-gray-400 text-sm">No live reviews submitted yet for this property.</p>
            <p className="text-gray-300 text-xs mt-1">Reviews submitted via the guest flow will appear here in real time.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E4E7EF] p-6">
            <LiveReviewsFeed events={recentEvents} />
          </div>
        )
      )}
    </div>
  );
}
