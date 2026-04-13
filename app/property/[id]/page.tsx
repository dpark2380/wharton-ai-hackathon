import { notFound } from "next/navigation";
import Link from "next/link";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { analyzeProperty, getKnowledgeHealthColor, getKnowledgeHealthLabel } from "@/lib/analysis";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import KnowledgeHealthScore from "@/components/KnowledgeHealthScore";
import TopicCoverageMap from "@/components/TopicCoverageMap";
import ReviewFlow from "@/components/ReviewFlow";
import { ArrowLeft, MapPin, Star, AlertTriangle, Clock, TrendingDown, MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`}
        />
      ))}
    </div>
  );
}

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params;

  const properties = loadProperties();
  const property = properties.find((p) => p.eg_property_id === id);
  if (!property) notFound();

  const reviews = getReviewsForProperty(id);
  const analysis = analyzeProperty(property, reviews);

  const propertyName = property.property_description
    .replace(/\|MASK\|/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

  const location = [property.city, property.province, property.country]
    .filter(Boolean)
    .join(", ");

  const healthColor = getKnowledgeHealthColor(analysis.knowledgeHealthScore);
  const healthLabel = getKnowledgeHealthLabel(analysis.knowledgeHealthScore);

  const recentReviews = reviews
    .filter((r) => r.review_text?.trim())
    .sort((a, b) => {
      const parse = (d: string) => {
        const [m, day, yr] = d.split("/");
        return new Date(2000 + parseInt(yr), parseInt(m) - 1, parseInt(day)).getTime();
      };
      return parse(b.acquisition_date) - parse(a.acquisition_date);
    })
    .slice(0, 6);

  return (
    <div className="min-h-screen" style={{ background: "#faf8f5" }}>
      {/* Header */}
      <header style={{ background: "#1a1a2e" }} className="sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "linear-gradient(135deg, #ff6b35, #f59e0b)" }}
            >
              E
            </div>
            <span className="text-white font-bold text-lg">Ask What Matters</span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Portfolio
          </Link>
        </div>
      </header>

      {/* Property hero */}
      <div style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {property.star_rating > 0 && <StarRow rating={property.star_rating} />}
                {property.star_rating > 0 && (
                  <Badge
                    variant="outline"
                    className="text-xs text-gray-300 border-gray-600"
                  >
                    {property.star_rating}-star
                  </Badge>
                )}
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
                  <span
                    key={a}
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "#ffffff15", color: "#cbd5e1" }}
                  >
                    {a.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <KnowledgeHealthScore
                score={analysis.knowledgeHealthScore}
                size="lg"
                showLabel
              />
              <div className="text-center">
                <p className="text-xs text-gray-500">{analysis.totalReviews} reviews</p>
                {property.guestrating_avg_expedia > 0 && (
                  <p className="text-sm font-bold" style={{ color: "#ff6b35" }}>
                    {property.guestrating_avg_expedia.toFixed(1)}/10 Expedia
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert bar for high-priority gaps */}
      {analysis.topGaps.filter((g) => g.gap === "high").length > 0 && (
        <div style={{ background: "#fffbeb", borderBottom: "1px solid #fde68a" }}>
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Critical gaps detected:</span>{" "}
              {analysis.topGaps
                .filter((g) => g.gap === "high")
                .map((g) => g.topicLabel)
                .join(", ")}{" "}
              — no reviews mention these topics.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs defaultValue="intelligence">
          <TabsList className="mb-6 bg-white border border-[#e5e0d8] p-1 rounded-xl">
            <TabsTrigger
              value="intelligence"
              className="rounded-lg data-[state=active]:bg-[#1a1a2e] data-[state=active]:text-white px-4"
            >
              Property Intelligence
            </TabsTrigger>
            <TabsTrigger
              value="review"
              className="rounded-lg data-[state=active]:bg-[#ff6b35] data-[state=active]:text-white px-4"
            >
              ✨ Smart Review
            </TabsTrigger>
          </TabsList>

          {/* Tab A: Intelligence */}
          <TabsContent value="intelligence">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Topic Coverage */}
                <div className="bg-white rounded-2xl border border-[#e5e0d8] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-[#1a1a2e]">Topic Coverage Map</h2>
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{ borderColor: healthColor, color: healthColor }}
                    >
                      {healthLabel} · {analysis.knowledgeHealthScore}/100
                    </Badge>
                  </div>
                  <TopicCoverageMap topics={analysis.topics} />
                </div>

                {/* Recent reviews */}
                {recentReviews.length > 0 && (
                  <div className="bg-white rounded-2xl border border-[#e5e0d8] p-6">
                    <h2 className="text-lg font-bold text-[#1a1a2e] mb-4 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-[#ff6b35]" />
                      Recent Reviews
                    </h2>
                    <div className="space-y-4">
                      {recentReviews.map((r, i) => (
                        <div key={i} className="border-b border-[#f0ede8] pb-4 last:border-0 last:pb-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {r.rating.overall > 0 && (
                                <span
                                  className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                                  style={{
                                    background:
                                      r.rating.overall >= 4 ? "#22c55e" : r.rating.overall >= 3 ? "#f59e0b" : "#ef4444",
                                  }}
                                >
                                  {r.rating.overall}/5
                                </span>
                              )}
                              {r.review_title && (
                                <span className="text-sm font-semibold text-[#1a1a2e]">{r.review_title}</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400">{r.acquisition_date}</span>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-3">{r.review_text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-5">
                {/* Gap Summary */}
                <div className="bg-white rounded-2xl border border-[#e5e0d8] p-5">
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Information Gaps
                  </h3>
                  <div className="space-y-2">
                    {analysis.topGaps.length === 0 ? (
                      <p className="text-sm text-green-600">No critical gaps detected!</p>
                    ) : (
                      analysis.topGaps.map((gap) => (
                        <div key={gap.topicId} className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              background:
                                gap.gap === "high" ? "#ef4444" : gap.gap === "medium" ? "#f59e0b" : "#3b82f6",
                            }}
                          />
                          <span className="text-sm text-gray-700 flex-1">{gap.topicLabel}</span>
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{
                              borderColor: gap.gap === "high" ? "#fecaca" : "#fde68a",
                              color: gap.gap === "high" ? "#ef4444" : "#f59e0b",
                            }}
                          >
                            {gap.gap}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Stale topics */}
                {analysis.topics.filter((t) => t.isStale).length > 0 && (
                  <div className="bg-white rounded-2xl border border-[#e5e0d8] p-5">
                    <h3 className="text-sm font-bold text-[#1a1a2e] mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      Stale Information
                    </h3>
                    <div className="space-y-2">
                      {analysis.topics
                        .filter((t) => t.isStale)
                        .map((t) => (
                          <div key={t.topicId} className="text-sm text-gray-600">
                            <span className="font-medium">{t.topicLabel}</span>
                            <span className="text-gray-400">
                              {" "}
                              — last mentioned {t.freshnessDays}d ago
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Sentiment shift alerts */}
                {analysis.topics.filter((t) => t.hasSentimentShift).length > 0 && (
                  <div className="bg-white rounded-2xl border border-red-200 p-5">
                    <h3 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" />
                      Sentiment Shifts
                    </h3>
                    <div className="space-y-2">
                      {analysis.topics
                        .filter((t) => t.hasSentimentShift)
                        .map((t) => (
                          <div key={t.topicId} className="text-sm text-red-600">
                            <span className="font-medium">{t.topicLabel}</span> — recent reviews
                            trending differently from historical sentiment.
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Property policies */}
                <div className="bg-white rounded-2xl border border-[#e5e0d8] p-5">
                  <h3 className="text-sm font-bold text-[#1a1a2e] mb-3">Property Info</h3>
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
                    {property.pet_policy.length > 0 && (
                      <div>
                        <span className="text-gray-500">Pets: </span>
                        <span className="font-medium text-xs">
                          {property.pet_policy[0].slice(0, 60)}...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab B: Smart Review */}
          <TabsContent value="review">
            <div className="max-w-2xl mx-auto">
              <ReviewFlow
                propertyId={id}
                propertyName={propertyName || "This Hotel"}
                city={property.city}
                country={property.country}
                currentHealthScore={analysis.knowledgeHealthScore}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
