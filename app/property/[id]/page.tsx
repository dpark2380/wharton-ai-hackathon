import { notFound } from "next/navigation";
import Link from "next/link";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { reviewStore } from "@/lib/store";
import { analyzeProperty, getKnowledgeHealthColor, getKnowledgeHealthLabel } from "@/lib/analysis";
import { generateHotelDisplayName } from "@/lib/utils";
import { getPropertyAlerts } from "@/lib/sentiment-alerts";
import { getLearnedWeights, learnPropertyWeights } from "@/lib/ml/continuous-learning";
import KnowledgeHealthScore from "@/components/KnowledgeHealthScore";
import {
  MapPin, Star, AlertTriangle, TrendingUp, MessageSquare,
  Users, BarChart3, ChevronRight, Flame, CheckCircle2,
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
  const healthColor = getKnowledgeHealthColor(analysis.knowledgeHealthScore);
  const healthLabel = getKnowledgeHealthLabel(analysis.knowledgeHealthScore);
  const sentimentAlerts = getPropertyAlerts(id).filter((a) => a.severity !== "none");
  const liveReviews = reviewStore.getLiveReviewsForProperty(id);
  const highGaps = analysis.topGaps.filter((g) => g.gap === "high");
  const wellCovered = analysis.topics.filter((t) => t.isRelevant && t.reviewCount >= 5 && !t.isStale).length;

  return (
    <div className="space-y-6 max-w-4xl">
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
            <KnowledgeHealthScore score={analysis.knowledgeHealthScore} size="lg" showLabel />
            <p className="text-xs text-white/50 text-center">Knowledge Health</p>
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
          icon={<BarChart3 className="w-4 h-4" />}
          label="Health score"
          value={analysis.knowledgeHealthScore}
          sub={healthLabel}
          color={healthColor}
        />
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Topics covered"
          value={wellCovered}
          sub={`of ${analysis.topics.filter((t) => t.isRelevant).length} relevant`}
          color="#22c55e"
        />
        <StatCard
          icon={<MessageSquare className="w-4 h-4" />}
          label="New today"
          value={liveReviews.length}
          sub="live submissions"
          color="#FFC72C"
        />
      </div>

      {/* Quick nav to sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          {
            href: `/property/${id}/topics`,
            label: "Topic Coverage",
            desc: `${analysis.topGaps.length} gaps need attention`,
            icon: <MapPin className="w-4 h-4" />,
            color: "#003580",
          },
          {
            href: `/property/${id}/insights`,
            label: "AI Insights",
            desc: "What guests are really saying",
            icon: <TrendingUp className="w-4 h-4" />,
            color: "#006FCF",
          },
          {
            href: `/property/${id}/reviews`,
            label: "Reviews Feed",
            desc: `${liveReviews.length} new since last visit`,
            icon: <MessageSquare className="w-4 h-4" />,
            color: "#22c55e",
          },
          {
            href: `/property/${id}/analytics`,
            label: "Rating Analytics",
            desc: "Score breakdowns by category",
            icon: <BarChart3 className="w-4 h-4" />,
            color: "#8b5cf6",
          },
        ].map(({ href, label, desc, icon, color }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 bg-white rounded-2xl border border-[#E4E7EF] px-5 py-4 hover:border-[#003580] hover:shadow-sm transition-all group"
          >
            <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: `${color}15` }}>
              <div style={{ color }}>{icon}</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1E243A]">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#003580] transition-colors flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
