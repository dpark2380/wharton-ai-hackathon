import { notFound } from "next/navigation";
import Link from "next/link";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { reviewStore } from "@/lib/store";
import { analyzeProperty, getKnowledgeHealthColor, getKnowledgeHealthLabel } from "@/lib/analysis";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import KnowledgeHealthScore from "@/components/KnowledgeHealthScore";
import TopicCoverageMap from "@/components/TopicCoverageMap";
import RatingAnalytics from "@/components/RatingAnalytics";
import { generateHotelDisplayName } from "@/lib/utils";
import { getPropertyAlerts } from "@/lib/sentiment-alerts";
import {
  ArrowLeft, MapPin, AlertTriangle, Clock,
  TrendingDown, PenLine, BarChart3, MessageSquare, Flame, TrendingUp, Star, Lightbulb,
} from "lucide-react";
import ManagerNotifications from "@/components/ManagerNotifications";
import PropertyInsights from "@/components/PropertyInsights";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}


export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params;

  const properties = loadProperties();
  const property = properties.find((p) => p.eg_property_id === id);
  if (!property) notFound();

  const reviews = getReviewsForProperty(id);
  const analysis = analyzeProperty(property, reviews);

  const propertyName = generateHotelDisplayName(
    property.property_description,
    property.city,
    property.country,
    property.star_rating
  );

  const location = [property.city, property.province, property.country].filter(Boolean).join(", ");
  const healthColor = getKnowledgeHealthColor(analysis.knowledgeHealthScore);
  const healthLabel = getKnowledgeHealthLabel(analysis.knowledgeHealthScore);

  // Ratings for analytics - pass only what RatingAnalytics needs (no text)
  const ratingsData = reviews.map((r) => ({
    rating: r.rating,
    acquisition_date: r.acquisition_date,
  }));

  const sentimentAlerts = getPropertyAlerts(id).filter((a) => a.severity !== "none");
  const liveReviews = reviewStore.getLiveReviewsForProperty(id);

  return (
    <div className="min-h-screen" style={{ background: "#faf8f5" }}>
      {/* Header */}
      <header style={{ background: "#1E243A" }} className="sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div>
              <span className="text-white font-bold text-sm">Ask What Matters</span>
              <span className="text-gray-400 text-xs block">Hotel Manager View</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={`/review/${id}`}
              className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #ff6b35, #f59e0b)" }}
            >
              <PenLine className="w-3.5 h-3.5" />
              Traveler Review Flow
            </Link>
            <Link href="/manager" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" />
              All Properties
            </Link>
            <ManagerNotifications />
          </div>
        </div>
      </header>

      {/* Property hero */}
      <div style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs text-amber-400 border-amber-600 bg-transparent">
                  Hotel Manager Analytics
                </Badge>
              </div>
              <h1 className="text-2xl font-extrabold text-white mb-1 leading-tight">
                {propertyName || "Hotel Property"}
              </h1>
              <div className="flex items-center gap-1 text-gray-400 text-sm mb-4">
                <MapPin className="w-3.5 h-3.5" />
                <span>{location}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {property.popular_amenities_list.slice(0, 8).map((a) => (
                  <span key={a} className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "#ffffff15", color: "#cbd5e1" }}>
                    {a.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 flex-shrink-0">
              <KnowledgeHealthScore score={analysis.knowledgeHealthScore} size="lg" showLabel />
              <div className="text-center space-y-0.5">
                <p className="text-xs text-gray-500">{analysis.totalReviews} total reviews</p>
                <p className="text-xs text-gray-500">{analysis.reviewsWithText} with text</p>
                {property.guestrating_avg_expedia > 0 && (
                  <p className="text-sm font-bold" style={{ color: "#ff6b35" }}>
                    {property.guestrating_avg_expedia.toFixed(1)}/10 Expedia score
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gap alert */}
      {analysis.topGaps.filter((g) => g.gap === "high").length > 0 && (
        <div style={{ background: "#fffbeb", borderBottom: "1px solid #fde68a" }}>
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Critical knowledge gaps:</span>{" "}
                {analysis.topGaps.filter((g) => g.gap === "high").map((g) => g.topicLabel).join(", ")}
              </p>
            </div>
            <Link
              href={`/review/${id}`}
              className="text-xs font-semibold text-amber-800 underline underline-offset-2 whitespace-nowrap"
            >
              Prompt travelers to fill these →
            </Link>
          </div>
        </div>
      )}

      {/* Trend alerts section */}
      {sentimentAlerts.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="bg-white rounded-2xl border border-[#e5e0d8] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#e5e0d8] flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-bold text-[#1a1a2e]">Trend Alerts — AI Review Analysis</h3>
              <span className="text-xs text-gray-400 ml-1">Areas where guest sentiment has recently worsened</span>
            </div>
            <div className="divide-y divide-[#f0ede8]">
              {sentimentAlerts.map((alert) => (
                <div key={alert.topicId} className="px-5 py-3 flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {alert.severity === "urgent" ? (
                      <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                        <Flame className="w-3 h-3" /> Urgent
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                        <TrendingDown className="w-3 h-3" /> Watch
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1a1a2e]">{alert.topicLabel}</p>
                    {alert.summary && (
                      <p className="text-sm text-gray-500 mt-0.5">{alert.summary}</p>
                    )}
                  </div>
                  <div className="hidden sm:block text-right text-xs text-gray-400 flex-shrink-0">
                    <p>{alert.recentReviewCount} recent mentions</p>
                    <p>vs {alert.historicalReviewCount} historical</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs defaultValue="coverage">
          <TabsList className="mb-6 bg-white border border-[#e5e0d8] p-1 rounded-xl">
            <TabsTrigger value="ratings" className="rounded-lg gap-2 data-[state=active]:bg-[#1a1a2e] data-[state=active]:text-white px-4">
              <BarChart3 className="w-4 h-4" /> Ratings & Trends
            </TabsTrigger>
            <TabsTrigger value="coverage" className="rounded-lg gap-2 data-[state=active]:bg-[#1a1a2e] data-[state=active]:text-white px-4">
              <MessageSquare className="w-4 h-4" /> Topic Coverage
            </TabsTrigger>
            <TabsTrigger value="insights" className="rounded-lg gap-2 data-[state=active]:bg-[#1a1a2e] data-[state=active]:text-white px-4">
              <Lightbulb className="w-4 h-4" /> Insights
            </TabsTrigger>
          </TabsList>

          {/* ── Tab A: Ratings & Trends ─────────────────────────────────────── */}
          <TabsContent value="ratings">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl border border-[#e5e0d8] p-6">
                  <h2 className="text-lg font-bold text-[#1a1a2e] mb-4">Rating Breakdown</h2>
                  <RatingAnalytics reviews={ratingsData} />
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-5">
                {/* Info gaps */}
                <div className="bg-white rounded-2xl border border-[#e5e0d8] p-5">
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Review Intelligence Gaps
                  </h3>
                  <div className="space-y-2">
                    {analysis.topGaps.length === 0 ? (
                      <p className="text-sm text-green-600">No critical gaps!</p>
                    ) : (
                      analysis.topGaps.map((gap) => {
                        const tier =
                          gap.reviewCount === 0 ? "critical"
                          : gap.freshnessDays !== null && gap.freshnessDays > 365 ? "urgent"
                          : gap.freshnessDays !== null && gap.freshnessDays > 180 ? "monitor"
                          : "low";
                        const dot =
                          tier === "critical" ? "🔴"
                          : tier === "urgent" ? "🟠"
                          : tier === "monitor" ? "🟡"
                          : "🔵";
                        const timeLabel =
                          gap.reviewCount === 0 ? "Never reviewed"
                          : gap.freshnessDays !== null ? `${Math.round(gap.freshnessDays / 30)}mo old`
                          : "Sparse";
                        return (
                          <div key={gap.topicId} className="flex items-center gap-2">
                            <span className="text-sm flex-shrink-0">{dot}</span>
                            <span className="text-sm text-gray-700 flex-1">{gap.topicLabel}</span>
                            <span className="text-xs text-gray-400">{timeLabel}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Stale */}
                {analysis.topics.filter((t) => t.isStale).length > 0 && (
                  <div className="bg-white rounded-2xl border border-[#e5e0d8] p-5">
                    <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      Stale Coverage
                    </h3>
                    <div className="space-y-1.5">
                      {analysis.topics.filter((t) => t.isStale).map((t) => (
                        <div key={t.topicId} className="text-sm text-gray-600">
                          <span className="font-medium">{t.topicLabel}</span>
                          <span className="text-gray-400">, {t.freshnessDays}d since last mention</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sentiment shifts */}
                {analysis.topics.filter((t) => t.hasSentimentShift).length > 0 && (
                  <div className="bg-white rounded-2xl border border-red-200 p-5">
                    <h3 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" />
                      Sentiment Shifts
                    </h3>
                    {analysis.topics.filter((t) => t.hasSentimentShift).map((t) => (
                      <p key={t.topicId} className="text-sm text-red-600">
                        <span className="font-medium">{t.topicLabel}</span>: recent reviews trending more negatively.
                      </p>
                    ))}
                  </div>
                )}

                {/* Live reviews */}
                {liveReviews.length > 0 && (
                  <div className="bg-white rounded-2xl border border-[#e5e0d8] p-5">
                    <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                      Live Reviews Today
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                        {liveReviews.length}
                      </span>
                    </h3>
                    <div className="space-y-3">
                      {liveReviews.map((r) => (
                        <div key={r.id} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-[#1a1a2e]">{r.travelerName}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(r.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 mb-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${i < r.overallRating ? "fill-amber-400 text-amber-400" : "fill-gray-100 text-gray-100"}`}
                              />
                            ))}
                          </div>
                          {r.reviewText && (
                            <p className="text-xs text-gray-500 italic line-clamp-2">
                              &ldquo;{r.reviewText}&rdquo;
                            </p>
                          )}
                          {r.answers.length > 0 && (
                            <div className="mt-1.5 space-y-1">
                              {r.answers.map((a) => (
                                <div key={a.topicId} className="text-xs">
                                  <span className="text-gray-400">{a.topicLabel}: </span>
                                  <span className="text-gray-600">{a.answer}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Policies */}
                <div className="bg-white rounded-2xl border border-[#e5e0d8] p-5">
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3">Property Policies</h3>
                  <div className="space-y-2 text-sm">
                    {property.check_in_start_time && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Check-in</span>
                        <span className="font-medium">{property.check_in_start_time}</span>
                      </div>
                    )}
                    {property.check_out_time && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Check-out</span>
                        <span className="font-medium">{property.check_out_time}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pets</span>
                      <span className="font-medium">
                        {property.pet_policy.join(" ").toLowerCase().includes("not allowed") ? "Not allowed" : "Allowed"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CTA for hotel */}
                <div className="rounded-2xl p-5 text-center"
                  style={{ background: "linear-gradient(135deg, #fff7f4, #fffbeb)" }}>
                  <p className="text-sm font-semibold text-[#1a1a2e] mb-1">Want to fill these gaps?</p>
                  <p className="text-xs text-gray-500 mb-3">
                    Share the traveler review link to prompt guests for the specific information you need.
                  </p>
                  <Link
                    href={`/review/${id}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl text-white transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #ff6b35, #f59e0b)" }}
                  >
                    <PenLine className="w-4 h-4" />
                    Open Traveler Review Flow
                  </Link>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Tab C: Insights ────────────────────────────────────────────── */}
          <TabsContent value="insights">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl border border-[#e5e0d8] p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-lg font-bold text-[#1a1a2e]">Review Insights</h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        AI analysis of the review corpus — weighted toward the last 90 days
                      </p>
                    </div>
                  </div>
                  <PropertyInsights propertyId={id} />
                </div>
              </div>
              <div className="space-y-5">
                <div className="bg-white rounded-2xl border border-[#e5e0d8] p-5">
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3">About These Insights</h3>
                  <div className="space-y-3 text-sm text-gray-500">
                    <p>Insights are generated by GPT-4o-mini reading your full review corpus.</p>
                    <p>Recent reviews (last 90 days) are weighted more heavily than older ones to surface emerging trends.</p>
                    <p>Insights are cached per session and regenerated when new reviews come in.</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-[#e5e0d8] p-5">
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-2">Tip</h3>
                  <p className="text-xs text-gray-500">
                    Open the <span className="font-semibold text-[#1a1a2e]">Topic Coverage</span> tab and click any topic cell to see an AI insight specific to that topic.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Tab B: Topic Coverage ───────────────────────────────────────── */}
          <TabsContent value="coverage">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl border border-[#e5e0d8] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-[#1a1a2e]">Topic Coverage Map</h2>
                    <Badge variant="outline" className="text-xs"
                      style={{ borderColor: healthColor, color: healthColor }}>
                      {healthLabel} · {analysis.knowledgeHealthScore}/100
                    </Badge>
                  </div>
                  <TopicCoverageMap topics={analysis.topics} reviews={reviews} propertyId={id} />
                </div>
              </div>

              <div className="space-y-5">
                <div className="bg-white rounded-2xl border border-[#e5e0d8] p-5">
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3">Coverage Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Topics tracked</span>
                      <span className="font-medium">{analysis.topics.filter(t => t.isRelevant).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Well covered</span>
                      <span className="font-medium text-green-600">
                        {analysis.topics.filter(t => t.isRelevant && t.gap === "none").length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Gaps detected</span>
                      <span className="font-medium text-red-500">
                        {analysis.topGaps.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Stale topics</span>
                      <span className="font-medium text-amber-500">
                        {analysis.topics.filter(t => t.isStale).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
