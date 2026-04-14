import Link from "next/link";
import { loadProperties, loadReviews } from "@/lib/data";
import { analyzeProperty } from "@/lib/analysis";
import { MapPin, Star, ArrowRight, Sparkles } from "lucide-react";
import { generateHotelDisplayName } from "@/lib/utils";

export const dynamic = "force-dynamic";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3 h-3 ${i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`} />
      ))}
    </div>
  );
}

export default function ReviewLandingPage() {
  const properties = loadProperties();
  const reviews = loadReviews();

  const cards = properties.map((p) => {
    const pr = reviews.filter((r) => r.eg_property_id === p.eg_property_id);
    const analysis = analyzeProperty(p, pr);
    const location = [p.city, p.province, p.country].filter(Boolean).join(", ");
    const shortName = generateHotelDisplayName(p.property_description, p.city, p.country, p.star_rating);
    return {
      id: p.eg_property_id,
      name: shortName,
      location,
      starRating: p.star_rating,
      guestRating: p.guestrating_avg_expedia,
      topGapCount: analysis.topGaps.length,
      healthScore: analysis.knowledgeHealthScore,
    };
  });

  return (
    <div className="min-h-screen" style={{ background: "#faf8f5" }}>
      {/* Header */}
      <header style={{ background: "#1a1a2e" }} className="sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "linear-gradient(135deg, #ff6b35, #f59e0b)" }}>E</div>
            <span className="text-white font-bold text-sm">Ask What Matters</span>
          </Link>
          <Link href="/" className="text-xs text-gray-400 hover:text-white transition-colors">
            Hotel Manager View →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}>
        <div className="max-w-3xl mx-auto px-6 py-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
            style={{ background: "#ff6b3520", color: "#ff6b35", border: "1px solid #ff6b3540" }}>
            <Sparkles className="w-3 h-3" />
            Powered by Expedia AI
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-3">
            Share your stay experience
          </h1>
          <p className="text-gray-300 text-base max-w-md mx-auto">
            Your review helps future travelers. We'll ask a couple of smart follow-up
            questions based on what your property most needs feedback on.
          </p>
        </div>
      </div>

      {/* Property list */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        <p className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">
          Select your hotel
        </p>
        <div className="space-y-3">
          {cards.map((card, i) => (
            <Link
              key={card.id}
              href={`/review/${card.id}`}
              className="flex items-center justify-between gap-4 bg-white rounded-2xl border border-[#e5e0d8] px-5 py-4 card-hover group animate-fade-in-up"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {card.starRating > 0 && <StarRow rating={card.starRating} />}
                </div>
                <p className="text-sm font-semibold text-[#1a1a2e] truncate">{card.name}</p>
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{card.location}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {card.guestRating > 0 && (
                  <div className="text-center hidden sm:block">
                    <p className="text-lg font-bold" style={{ color: "#ff6b35" }}>
                      {card.guestRating.toFixed(1)}
                    </p>
                    <p className="text-xs text-gray-400">/ 10</p>
                  </div>
                )}
                {card.topGapCount > 0 && (
                  <div className="text-center hidden sm:block">
                    <p className="text-sm font-bold text-amber-600">{card.topGapCount}</p>
                    <p className="text-xs text-gray-400">gaps</p>
                  </div>
                )}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                  style={{ background: "linear-gradient(135deg, #ff6b35, #f59e0b)" }}
                >
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
