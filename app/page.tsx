import { Suspense } from "react";
import Link from "next/link";
import { loadProperties, loadReviews } from "@/lib/data";
import { analyzeProperty } from "@/lib/analysis";
import PropertyCard from "@/components/PropertyCard";
import { BarChart3, Sparkles, TrendingUp, PenLine } from "lucide-react";

export const dynamic = "force-dynamic";

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#e5e0d8] p-5 h-72 shimmer" />
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

  // Sort: lowest health score first (most need attention)
  cards.sort((a, b) => a.knowledgeHealthScore - b.knowledgeHealthScore);

  const avgScore = Math.round(
    cards.reduce((s, c) => s + c.knowledgeHealthScore, 0) / cards.length
  );
  const totalReviews = cards.reduce((s, c) => s + c.totalReviews, 0);
  const highGapCount = cards.filter((c) => c.knowledgeHealthScore < 50).length;

  return (
    <>
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            icon: <BarChart3 className="w-5 h-5" style={{ color: "#ff6b35" }} />,
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
              <p className="text-2xl font-bold text-[#1a1a2e]">{stat.value}</p>
              <p className="text-xs text-gray-500">
                <span className="font-medium">{stat.label}</span> {stat.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Property grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card, i) => (
          <PropertyCard key={card.id} {...card} index={i} />
        ))}
      </div>
    </>
  );
}

export default function HomePage() {
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
            <div>
              <span className="text-white font-bold text-lg">Ask What Matters</span>
              <span className="text-gray-500 text-xs block">Expedia Review Intelligence</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/review"
              className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #ff6b35, #f59e0b)" }}
            >
              <PenLine className="w-3.5 h-3.5" />
              Traveler Review
            </Link>
            <span className="text-xs text-gray-500 hidden sm:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              GPT-4o mini
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)" }}>
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="max-w-2xl animate-fade-in-up">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
              style={{ background: "#ff6b3520", color: "#ff6b35", border: "1px solid #ff6b3540" }}
            >
              <Sparkles className="w-3 h-3" />
              Wharton Hack-AI-thon 2026 · Expedia Group
            </div>
            <h1 className="text-4xl font-extrabold text-white leading-tight mb-3">
              Reviews that{" "}
              <span className="gradient-text">actually answer</span>{" "}
              what matters
            </h1>
            <p className="text-gray-300 text-base leading-relaxed">
              Our AI detects knowledge gaps in hotel reviews and asks reviewers the
              exact follow-up questions that fill them — turning incomplete feedback
              into actionable property intelligence.
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[#1a1a2e]">Property Portfolio</h2>
            <p className="text-sm text-gray-500">Sorted by knowledge health score — lowest first</p>
          </div>
        </div>
        <Suspense fallback={<LoadingSkeleton />}>
          <PropertyGrid />
        </Suspense>
      </main>
    </div>
  );
}
