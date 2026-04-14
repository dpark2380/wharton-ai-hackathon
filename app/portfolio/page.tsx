import { Suspense } from "react";
import Link from "next/link";
import { loadProperties, loadReviews } from "@/lib/data";
import { analyzeProperty } from "@/lib/analysis";
import PropertyCard from "@/components/PropertyCard";
import { BarChart3, Sparkles, TrendingUp, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#e5e0d8] p-5 h-72 flex flex-col gap-4">
          <div className="w-full h-32 bg-gray-100 rounded-xl shimmer" />
          <div className="space-y-3">
            <div className="h-5 w-3/4 bg-gray-100 rounded shimmer" />
            <div className="h-4 w-1/2 bg-gray-50 rounded shimmer" />
          </div>
          <div className="mt-auto h-8 w-full bg-gray-100 rounded-lg shimmer" />
        </div>
      ))}
    </div>
  );
}

async function PropertyGrid() {
  const properties = loadProperties();
  const reviews = loadReviews();

  const cards = properties.map((property) => {
    const propertyReviews = reviews.filter(
      (r) => r.eg_property_id === property.eg_property_id
    );
    const analysis = analyzeProperty(property, propertyReviews);

    return {
      id: property.eg_property_id,
      city: property.city,
      country: property.country,
      province: property.province,
      star_rating: property.star_rating,
      guestrating_avg_expedia: property.guestrating_avg_expedia,
      popular_amenities_list: property.popular_amenities_list,
      property_description: property.property_description,
      knowledgeHealthScore: analysis.knowledgeHealthScore,
      totalReviews: analysis.totalReviews,
      topGaps: analysis.topGaps,
      topTopics: analysis.topics
        .filter((t) => t.isRelevant)
        .sort((a, b) => b.coverageScore - a.coverageScore)
        .slice(0, 5),
    };
  });

  cards.sort((a, b) => a.knowledgeHealthScore - b.knowledgeHealthScore);

  const avgScore = Math.round(
    cards.reduce((s, c) => s + c.knowledgeHealthScore, 0) / cards.length
  );
  const totalReviews = cards.reduce((s, c) => s + c.totalReviews, 0);
  const highGapCount = cards.filter((c) => c.knowledgeHealthScore < 50).length;

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            icon: <BarChart3 className="w-5 h-5" style={{ color: "#FEBF4F" }} />,
            value: cards.length,
            label: "Properties",
            sub: "in portfolio",
          },
          {
            icon: <TrendingUp className="w-5 h-5 text-green-500" />,
            value: totalReviews.toLocaleString(),
            label: "Total Reviews",
            sub: "analyzed",
          },
          {
            icon: <Sparkles className="w-5 h-5 text-amber-500" />,
            value: avgScore,
            label: "Avg Health Score",
            sub: `${highGapCount} need attention`,
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-[#e5e0d8] p-4 flex items-center gap-3"
          >
            <div className="p-2 bg-[#faf8f5] rounded-xl">{stat.icon}</div>
            <div>
              <p className="text-2xl font-bold text-[#1E243A]">{stat.value}</p>
              <p className="text-xs text-gray-500">
                <span className="font-medium">{stat.label}</span> {stat.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card, i) => (
          <PropertyCard key={card.id} {...card} index={i} />
        ))}
      </div>
    </>
  );
}

export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
              style={{ background: "#FEBF4F", color: "#1E243A" }}
            >
              E
            </div>
            <div>
              <span className="font-bold text-[#1E243A] text-base">Ask What Matters</span>
              <span className="text-gray-400 text-xs block">Hotel Manager View</span>
            </div>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#1E243A] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: "linear-gradient(160deg, #FEBF4F 0%, #FDD47C 60%, #FFF3CD 100%)" }}>
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="max-w-2xl">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
              style={{
                background: "rgba(30,36,58,0.08)",
                color: "#1E243A",
                border: "1px solid rgba(30,36,58,0.12)",
              }}
            >
              <Sparkles className="w-3 h-3" />
              Wharton Hack-AI-thon 2026 · Expedia Group
            </div>
            <h1 className="text-4xl font-extrabold text-[#1E243A] leading-tight mb-3">
              Property Portfolio
            </h1>
            <p className="text-[#1E243A]/70 text-base leading-relaxed">
              Review intelligence across your portfolio, sorted by knowledge health score.
              Properties with the most gaps appear first.
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8 bg-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[#1E243A]">All Properties</h2>
            <p className="text-sm text-gray-500">Sorted by knowledge health score, lowest first</p>
          </div>
        </div>
        <Suspense fallback={<LoadingSkeleton />}>
          <PropertyGrid />
        </Suspense>
      </main>
    </div>
  );
}
