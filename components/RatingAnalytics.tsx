"use client";

import { Review } from "@/lib/data";

interface RatingAnalyticsProps {
  reviews: Pick<Review, "rating" | "acquisition_date">[];
}

const SUBCATEGORIES: {
  key: keyof Review["rating"];
  label: string;
  description: string;
}[] = [
  { key: "overall",              label: "Overall",          description: "Overall stay experience" },
  { key: "roomcleanliness",      label: "Room Cleanliness", description: "How clean the room was" },
  { key: "service",              label: "Service",          description: "Staff helpfulness & friendliness" },
  { key: "hotelcondition",       label: "Hotel Condition",  description: "Upkeep and maintenance" },
  { key: "roomcomfort",          label: "Room Comfort",     description: "Bed, temperature, quiet" },
  { key: "roomamenitiesscore",   label: "Room Amenities",   description: "In-room features & facilities" },
  { key: "ecofriendliness",      label: "Eco-Friendliness", description: "Sustainability practices" },
];

// Keys that are almost always null in this dataset — only show if they have data
const SPARSE_KEYS = new Set([
  "roomquality", "convenienceoflocation", "neighborhoodsatisfaction",
  "valueformoney", "communication", "checkin", "onlinelisting", "location",
]);

function ratingColor(score: number): string {
  if (score >= 4.5) return "#22c55e";
  if (score >= 4.0) return "#84cc16";
  if (score >= 3.5) return "#f59e0b";
  if (score >= 3.0) return "#f97316";
  return "#ef4444";
}

function ratingLabel(score: number): string {
  if (score >= 4.5) return "Excellent";
  if (score >= 4.0) return "Good";
  if (score >= 3.5) return "Fair";
  if (score >= 3.0) return "Below Average";
  return "Poor";
}

interface SubcategoryStats {
  avg: number;
  count: number;
  coverageRate: number; // % of reviews that rated this
  trend: "up" | "down" | "flat" | "insufficient";
}

function computeStats(
  reviews: Pick<Review, "rating" | "acquisition_date">[],
  key: keyof Review["rating"]
): SubcategoryStats | null {
  const rated = reviews.filter((r) => r.rating[key] > 0);
  if (rated.length === 0) return null;

  const avg = rated.reduce((s, r) => s + r.rating[key], 0) / rated.length;
  const coverageRate = rated.length / reviews.length;

  // Trend: compare last 3 months vs prior
  const now = new Date("2026-04-13");
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 3);

  const parse = (d: string) => {
    const [m, day, yr] = d.split("/");
    return new Date(2000 + parseInt(yr), parseInt(m) - 1, parseInt(day));
  };

  const recent = rated.filter((r) => parse(r.acquisition_date) >= cutoff);
  const older  = rated.filter((r) => parse(r.acquisition_date) <  cutoff);

  let trend: SubcategoryStats["trend"] = "insufficient";
  if (recent.length >= 3 && older.length >= 5) {
    const recentAvg = recent.reduce((s, r) => s + r.rating[key], 0) / recent.length;
    const olderAvg  = older.reduce((s, r)  => s + r.rating[key], 0) / older.length;
    const diff = recentAvg - olderAvg;
    trend = diff > 0.15 ? "up" : diff < -0.15 ? "down" : "flat";
  }

  return { avg, count: rated.length, coverageRate, trend };
}

function TrendBadge({ trend }: { trend: SubcategoryStats["trend"] }) {
  if (trend === "insufficient") return null;
  const cfg = {
    up:   { label: "↑ Improving", color: "#22c55e", bg: "#f0fdf4" },
    down: { label: "↓ Declining", color: "#ef4444", bg: "#fef2f2" },
    flat: { label: "→ Stable",    color: "#64748b", bg: "#f8fafc" },
  }[trend];
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg }}
      translate="no"
    >
      {cfg.label}
    </span>
  );
}

export default function RatingAnalytics({ reviews }: RatingAnalyticsProps) {
  if (reviews.length === 0) {
    return <p className="text-sm text-gray-400">No rating data available.</p>;
  }

  const statsMap = new Map<keyof Review["rating"], SubcategoryStats | null>(
    SUBCATEGORIES.map((s) => [s.key, computeStats(reviews, s.key)])
  );

  const withData = SUBCATEGORIES.filter((s) => statsMap.get(s.key) !== null);

  // Summary row
  const overallStats = statsMap.get("overall");

  return (
    <div className="space-y-6">
      {/* Summary */}
      {overallStats && (
        <div
          className="rounded-2xl p-5 flex items-center gap-5"
          style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}
        >
          <div className="text-center flex-shrink-0">
            <p
              className="text-5xl font-extrabold"
              style={{ color: ratingColor(overallStats.avg) }}
              translate="no"
            >
              {overallStats.avg.toFixed(1)}
            </p>
            <p className="text-xs text-gray-400 mt-1">out of 5</p>
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold">
              {ratingLabel(overallStats.avg)} overall
            </p>
            <p className="text-gray-400 text-sm mt-0.5">
              Based on {overallStats.count.toLocaleString()} rated reviews
              &nbsp;·&nbsp;
              {Math.round(overallStats.coverageRate * 100)}% of all reviews include an overall score
            </p>
            <div className="mt-2">
              <TrendBadge trend={overallStats.trend} />
            </div>
          </div>
        </div>
      )}

      {/* Subcategory bars */}
      <div className="space-y-3">
        {withData.filter((s) => s.key !== "overall").map((sub) => {
          const stats = statsMap.get(sub.key)!;
          const color = ratingColor(stats.avg);
          const pct = (stats.avg / 5) * 100;

          return (
            <div key={sub.key} className="bg-white rounded-2xl border border-[#e5e0d8] p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold text-[#1a1a2e]">{sub.label}</p>
                  <p className="text-xs text-gray-400">{sub.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <TrendBadge trend={stats.trend} />
                  <span
                    className="text-lg font-bold"
                    style={{ color }}
                    translate="no"
                  >
                    {stats.avg.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span translate="no">{stats.count} rated reviews</span>
                <span translate="no">
                  {stats.coverageRate < 0.3 && (
                    <span className="text-amber-600 font-medium mr-2">
                      Low coverage ({Math.round(stats.coverageRate * 100)}%)
                    </span>
                  )}
                  {ratingLabel(stats.avg)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Null-rate callout */}
      <div className="rounded-xl border border-[#e5e0d8] p-4 bg-[#faf8f5]">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Data Gaps in Structured Ratings
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SUBCATEGORIES.filter((s) => {
            const st = statsMap.get(s.key);
            return st && st.coverageRate < 0.5;
          }).map((s) => {
            const st = statsMap.get(s.key)!;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: st.coverageRate < 0.15 ? "#ef4444" : "#f59e0b" }}
                />
                <span className="text-xs text-gray-600">{s.label}</span>
                <span className="text-xs text-gray-400 ml-auto" translate="no">
                  {Math.round(st.coverageRate * 100)}%
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          These subcategories have low completion rates — smart follow-up questions can help fill them.
        </p>
      </div>
    </div>
  );
}
