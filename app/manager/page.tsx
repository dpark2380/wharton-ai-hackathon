import Link from "next/link";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { analyzeProperty, getKnowledgeHealthColor } from "@/lib/analysis";
import { generateHotelDisplayName } from "@/lib/utils";
import { reviewStore } from "@/lib/store";
import {
  ArrowRight, MapPin, BarChart3, Users, TrendingUp, Activity,
  AlertTriangle, CheckCircle2, User, Flame,
} from "lucide-react";
import ManagerNotifications from "@/components/ManagerNotifications";
import { getAlertCount } from "@/lib/sentiment-alerts";
import LiveReviewsFeed, { LiveReviewEvent } from "@/components/LiveReviewsFeed";

export const dynamic = "force-dynamic";

function HealthBadge({ score }: { score: number }) {
  const color = getKnowledgeHealthColor(score);
  const bg =
    score >= 70 ? "#f0fdf4" :
    score >= 40 ? "#fffbeb" :
    "#fef2f2";
  return (
    <div
      className="flex items-center justify-center w-12 h-12 rounded-xl font-extrabold text-sm flex-shrink-0"
      style={{ background: bg, color, border: `1.5px solid ${color}30` }}
    >
      {score}
    </div>
  );
}

function GapPill({ label }: { label: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200">
      {label}
    </span>
  );
}

export default function ManagerPage() {
  const properties = loadProperties();

  const rows = properties
    .map((property) => {
      const reviews = getReviewsForProperty(property.eg_property_id);
      const analysis = analyzeProperty(property, reviews);
      const topGap = analysis.topics
        .filter((t) => t.isRelevant && t.gap !== "none")
        .sort((a, b) => a.coverageScore - b.coverageScore)[0];

      const alertCounts = getAlertCount(property.eg_property_id);

      return {
        id: property.eg_property_id,
        name: generateHotelDisplayName(
          property.property_description,
          property.city,
          property.country,
          property.star_rating
        ),
        location: [property.city, property.province, property.country].filter(Boolean).join(", "),
        guestRating: property.guestrating_avg_expedia,
        healthScore: analysis.knowledgeHealthScore,
        totalReviews: analysis.totalReviews,
        topGap: topGap?.topicLabel ?? null,
        gapCount: analysis.topGaps.length,
        urgentAlerts: alertCounts.urgent,
        watchAlerts: alertCounts.watch,
      };
    })
    .sort((a, b) => a.healthScore - b.healthScore);

  const avgScore = Math.round(rows.reduce((s, r) => s + r.healthScore, 0) / rows.length);
  const totalReviews = rows.reduce((s, r) => s + r.totalReviews, 0);
  const liveToday = reviewStore.getTotalLiveReviews();
  const propertiesNeedingAttention = rows.filter((r) => r.healthScore < 50).length;
  const recentEvents: LiveReviewEvent[] = reviewStore.getRecentEvents(20).map((event) => {
    const liveReviews = reviewStore.getLiveReviewsForProperty(event.propertyId);
    const liveReview = liveReviews.find((r) => r.id === event.id);
    return {
      ...event,
      submittedAt: event.submittedAt.toISOString(),
      answers: liveReview?.answers ?? [],
      photos: event.photos ?? [],
    };
  });

  return (
    <div className="min-h-screen" style={{ background: "#f5f7fa" }}>
      {/* Header */}
      <header style={{ background: "#1E243A" }} className="sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div>
              <span className="text-white font-bold text-sm">Ask What Matters</span>
              <span className="text-gray-400 text-xs block">Hotel Manager View</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              Traveler View
            </Link>
            <ManagerNotifications />
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <div style={{ background: "#1E243A", borderTop: "1px solid #ffffff10" }}>
        <div className="max-w-6xl mx-auto px-6 pb-6 pt-2">
          <div className="grid grid-cols-4 gap-4">
            {[
              {
                icon: <BarChart3 className="w-4 h-4 text-blue-400" />,
                value: rows.length,
                label: "Properties",
              },
              {
                icon: <Users className="w-4 h-4 text-green-400" />,
                value: totalReviews.toLocaleString(),
                label: "Total Reviews",
              },
              {
                icon: <TrendingUp className="w-4 h-4 text-amber-400" />,
                value: avgScore,
                label: "Avg Health Score",
              },
              {
                icon: <Activity className="w-4 h-4 text-rose-400" />,
                value: liveToday,
                label: "Live Reviews Today",
              },
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg" style={{ background: "#ffffff10" }}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-xl font-bold text-white leading-none">{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#1E243A]">All Properties</h2>
            <p className="text-sm text-gray-500">
              Sorted by health score — lowest first.
              {propertiesNeedingAttention > 0 && (
                <span className="ml-1 text-amber-600 font-medium">
                  {propertiesNeedingAttention} {propertiesNeedingAttention === 1 ? "property needs" : "properties need"} attention.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Live reviews feed */}
        <LiveReviewsFeed events={recentEvents} />

        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#1E243A]">All Properties</h2>
            <p className="text-sm text-gray-500">
              Sorted by health score — lowest first.
              {propertiesNeedingAttention > 0 && (
                <span className="ml-1 text-amber-600 font-medium">
                  {propertiesNeedingAttention} {propertiesNeedingAttention === 1 ? "property needs" : "properties need"} attention.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Property rows */}
        <div className="space-y-2">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/property/${row.id}`}
              className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 px-5 py-4 hover:border-[#1E243A] hover:shadow-sm transition-all group"
            >
              <HealthBadge score={row.healthScore} />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1E243A] truncate group-hover:text-[#003580] transition-colors">
                  {row.name}
                </p>
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{row.location}</span>
                </div>
              </div>

              <div className="hidden sm:block text-center flex-shrink-0 w-20">
                <p className="text-sm font-semibold text-[#1E243A]">{row.totalReviews.toLocaleString()}</p>
                <p className="text-xs text-gray-400">reviews</p>
              </div>

              {row.guestRating > 0 ? (
                <div className="hidden md:block text-center flex-shrink-0 w-20">
                  <p className="text-sm font-semibold text-[#003580]">{row.guestRating.toFixed(1)}</p>
                  <p className="text-xs text-gray-400">/ 10 rating</p>
                </div>
              ) : (
                <div className="hidden md:block w-20" />
              )}

              <div className="hidden lg:flex flex-shrink-0 w-44 items-center gap-2">
                {row.urgentAlerts > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                    <Flame className="w-3 h-3" />
                    {row.urgentAlerts} urgent
                  </span>
                )}
                {row.watchAlerts > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                    {row.watchAlerts} watch
                  </span>
                )}
                {row.urgentAlerts === 0 && row.watchAlerts === 0 && row.topGap && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    <GapPill label={row.topGap} />
                  </div>
                )}
                {row.urgentAlerts === 0 && row.watchAlerts === 0 && !row.topGap && (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Well covered
                  </div>
                )}
              </div>

              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1E243A] transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
