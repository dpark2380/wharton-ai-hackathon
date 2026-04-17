import { notFound } from "next/navigation";
import Link from "next/link";
import { loadProperties, getReviewsForProperty, parseReviewDate, type Review } from "@/lib/data";
import { reviewStore } from "@/lib/store";
import { analyzeProperty } from "@/lib/analysis";
import { generateHotelDisplayName } from "@/lib/utils";
import { getPropertyAlerts } from "@/lib/sentiment-alerts";
import { getLearnedWeights, learnPropertyWeights } from "@/lib/ml/continuous-learning";
import CoverageScore from "@/components/CoverageScore";
import {
  MapPin, Star, AlertTriangle, TrendingUp, MessageSquare,
  Users, Clock, ChevronRight, Flame,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color = "#003580",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E4E7EF] p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ background: `${color}15` }}>
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
      <p className="text-2xl font-extrabold text-[#1E243A] leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      <p className="text-sm text-gray-500 mt-2">{label}</p>
    </div>
  );
}

export default async function PropertyOverviewPage({ params }: Props) {
  const { id } = await params;

  const properties = loadProperties();
  const property = properties.find((p) => p.eg_property_id === id);
  if (!property) notFound();

  const reviews = getReviewsForProperty(id);
  const learnedWeights = getLearnedWeights(id) ?? learnPropertyWeights(id, reviews);
  const analysis = analyzeProperty(property, reviews, false, learnedWeights);

  const propertyName = generateHotelDisplayName(
    property.property_description,
    property.city,
    property.country,
    property.star_rating
  );
  const location = [property.city, property.province, property.country].filter(Boolean).join(", ");
  const sentimentAlerts = getPropertyAlerts(id).filter((a) => a.severity !== "none");
  const liveReviews = reviewStore.getLiveReviewsForProperty(id);
  const highGaps = analysis.topGaps.filter((g) => g.gap === "high");

  // Review freshness: % of reviews from last 90 days
  const NOW = new Date("2026-04-13");
  const MS = 24 * 60 * 60 * 1000;
  const freshCount = reviews.filter((r) => (NOW.getTime() - parseReviewDate(r.acquisition_date).getTime()) / MS <= 90).length;
  const freshnessPct = reviews.length > 0 ? Math.round((freshCount / reviews.length) * 100) : 0;
  const freshnessColor = freshnessPct >= 50 ? "#22c55e" : freshnessPct >= 20 ? "#f59e0b" : "#ef4444";

  // Sentiment trend: last 30d positive % vs prior 30d
  const isPos = (r: Review) => (r.rating?.overall ?? 0) >= 4;
  const last30 = reviews.filter((r) => { const d = (NOW.getTime() - parseReviewDate(r.acquisition_date).getTime()) / MS; return d >= 0 && d <= 30; });
  const prev30 = reviews.filter((r) => { const d = (NOW.getTime() - parseReviewDate(r.acquisition_date).getTime()) / MS; return d > 30 && d <= 60; });
  const last30Pos = last30.length > 0 ? Math.round((last30.filter(isPos).length / last30.length) * 100) : null;
  const prev30Pos = prev30.length > 0 ? Math.round((prev30.filter(isPos).length / prev30.length) * 100) : null;
  let trendValue: string, trendSub: string, trendColor: string;
  if (last30Pos !== null && prev30Pos !== null) {
    const delta = last30Pos - prev30Pos;
    trendValue = `${delta >= 0 ? "+" : ""}${delta}%`;
    trendSub = `${prev30Pos}% → ${last30Pos}% positive`;
    trendColor = delta >= 0 ? "#22c55e" : "#ef4444";
  } else if (last30Pos !== null) {
    trendValue = `${last30Pos}%`;
    trendSub = "positive this month";
    trendColor = last30Pos >= 70 ? "#22c55e" : "#f59e0b";
  } else {
    const allPos = reviews.length > 0 ? Math.round((reviews.filter(isPos).length / reviews.length) * 100) : 0;
    trendValue = `${allPos}%`;
    trendSub = "overall positive rate";
    trendColor = allPos >= 70 ? "#22c55e" : allPos >= 50 ? "#f59e0b" : "#ef4444";
  }

  return (
    <div className="space-y-6">
      {/* Property hero card */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #003580 0%, #006FCF 100%)" }}
      >
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #FFC72C 0%, transparent 60%)" }} />

        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-white/60 text-xs uppercase tracking-widest mb-1">Your Property</p>
            <h2 className="text-xl font-extrabold text-white leading-tight mb-1">
              {propertyName ?? "Your Hotel"}
            </h2>
            <div className="flex items-center gap-1 text-white/60 text-sm mb-3">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{location}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {property.star_rating > 0 && (
                <div className="flex items-center gap-1">
                  {Array.from({ length: property.star_rating }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-[#FFC72C] text-[#FFC72C]" />
                  ))}
                </div>
              )}
              {property.guestrating_avg_expedia > 0 && (
                <span className="text-sm font-semibold text-white/90">
                  {property.guestrating_avg_expedia.toFixed(1)}/10 guest rating
                </span>
              )}
              {liveReviews.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "#FFC72C", color: "#1E243A" }}>
                  +{liveReviews.length} new today
                </span>
              )}
            </div>
          </div>

          {/* KHS ring */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <CoverageScore score={analysis.coverageScore} size="lg" showLabel />
            <p className="text-xs text-white/50 text-center">Coverage Score</p>
          </div>
        </div>
      </div>

      {/* Alert banners */}
      {highGaps.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {highGaps.length} critical knowledge {highGaps.length === 1 ? "gap" : "gaps"}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {highGaps.map((g) => g.topicLabel).join(" · ")}: no guest reviews yet
            </p>
          </div>
          <Link href={`/property/${id}/topics`}
            className="text-xs font-semibold text-amber-800 underline underline-offset-2 whitespace-nowrap flex-shrink-0">
            View topics →
          </Link>
        </div>
      )}

      {sentimentAlerts.filter((a) => a.severity === "urgent").length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <Flame className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">Sentiment decline detected</p>
            <p className="text-xs text-red-700 mt-0.5">
              {sentimentAlerts.filter((a) => a.severity === "urgent").map((a) => a.topicLabel).join(" · ")}
            </p>
          </div>
          <Link href={`/property/${id}/insights`}
            className="text-xs font-semibold text-red-800 underline underline-offset-2 whitespace-nowrap flex-shrink-0">
            View insights →
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Total reviews"
          value={analysis.totalReviews.toLocaleString()}
          sub={`${analysis.reviewsWithText} with text`}
          color="#003580"
        />
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Review freshness"
          value={`${freshnessPct}%`}
          sub={`${freshCount} of ${reviews.length} in last 90d`}
          color={freshnessColor}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Sentiment trend"
          value={trendValue}
          sub={trendSub}
          color={trendColor}
        />
        <StatCard
          icon={<MessageSquare className="w-4 h-4" />}
          label="New today"
          value={liveReviews.length}
          sub="live submissions"
          color="#FFC72C"
        />
      </div>

    </div>
  );
}
