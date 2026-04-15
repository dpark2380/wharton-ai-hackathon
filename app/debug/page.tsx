import Link from "next/link";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { analyzeProperty, getKnowledgeHealthColor } from "@/lib/analysis";
import { generateHotelDisplayName } from "@/lib/utils";
import { ArrowRight, MapPin, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function ScoreBadge({ score }: { score: number }) {
  const color = getKnowledgeHealthColor(score);
  const bg = score >= 70 ? "#f0fdf4" : score >= 40 ? "#fffbeb" : "#fef2f2";
  return (
    <div className="w-11 h-11 rounded-xl font-extrabold text-sm flex items-center justify-center flex-shrink-0"
      style={{ background: bg, color, border: `1.5px solid ${color}30` }}>
      {score}
    </div>
  );
}

export default function DebugPage() {
  const properties = loadProperties();
  const rows = properties
    .map((p) => {
      const reviews = getReviewsForProperty(p.eg_property_id);
      const analysis = analyzeProperty(p, reviews);
      return {
        id: p.eg_property_id,
        name: generateHotelDisplayName(p.property_description, p.city, p.country, p.star_rating),
        location: [p.city, p.province, p.country].filter(Boolean).join(", "),
        healthScore: analysis.knowledgeHealthScore,
        totalReviews: analysis.totalReviews,
        guestRating: p.guestrating_avg_expedia,
      };
    })
    .sort((a, b) => a.healthScore - b.healthScore);

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      <header className="sticky top-0 z-50 h-14 px-6 flex items-center justify-between overflow-hidden bg-white border-b border-[#E4E7EF]">
        <div className="flex items-center gap-4">
          <Link href="/manager"><img src="/Expedia-Logo.svg.png" alt="Expedia" className="h-10 w-auto" /></Link>
          <span className="text-gray-500 text-xs">Debug: All Properties</span>
        </div>
        <Link href="/manager" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to login
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-3">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">
          {rows.length} properties · sorted by health score
        </p>
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/property/${row.id}`}
            className="flex items-center gap-4 bg-white rounded-2xl border border-[#E4E7EF] px-5 py-4 hover:border-[#003580] hover:shadow-sm transition-all group"
          >
            <ScoreBadge score={row.healthScore} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1E243A] truncate group-hover:text-[#003580] transition-colors">
                {row.name}
              </p>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{row.location}</span>
              </div>
            </div>
            <div className="hidden sm:block text-right text-xs text-gray-400 w-20 flex-shrink-0">
              <p className="font-semibold text-[#1E243A] text-sm">{row.totalReviews.toLocaleString()}</p>
              <p>reviews</p>
            </div>
            {row.guestRating > 0 && (
              <div className="hidden md:block text-right text-xs text-gray-400 w-16 flex-shrink-0">
                <p className="font-semibold text-[#003580] text-sm">{row.guestRating.toFixed(1)}</p>
                <p>/ 10</p>
              </div>
            )}
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#003580] transition-colors flex-shrink-0" />
          </Link>
        ))}
      </main>
    </div>
  );
}
