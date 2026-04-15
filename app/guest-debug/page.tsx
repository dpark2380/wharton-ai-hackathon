import Link from "next/link";
import { loadProperties, getReviewsForProperty } from "@/lib/data";
import { analyzeProperty } from "@/lib/analysis";
import { generateHotelDisplayName } from "@/lib/utils";
import { ArrowRight, ArrowLeft, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default function GuestDebugPage() {
  const properties = loadProperties();

  const hotels = properties.map((p) => {
    const reviews = getReviewsForProperty(p.eg_property_id);
    const analysis = analyzeProperty(p, reviews);
    return {
      id: p.eg_property_id,
      name: generateHotelDisplayName(p.property_description, p.city, p.country, p.star_rating),
      location: [p.city, p.province, p.country].filter(Boolean).join(", "),
      guestRating: p.guestrating_avg_expedia,
    };
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5F7FA" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 h-14 px-6 flex items-center justify-between overflow-hidden bg-white border-b border-[#E4E7EF]">
        <Link href="/"><img src="/Expedia-Logo.svg.png" alt="Expedia" className="h-10 w-auto" /></Link>
        <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
      </header>

      {/* Hero */}
      <div style={{ background: "linear-gradient(160deg, #003580 0%, #006FCF 100%)" }}>
        <div className="max-w-xl mx-auto px-4 py-10 text-center">
          <p className="text-[#FFC72C] text-xs font-bold uppercase tracking-widest mb-2">Debug</p>
          <h1 className="text-2xl font-extrabold text-white mb-1">Select a hotel to review</h1>
          <p className="text-white/60 text-sm">{hotels.length} properties available</p>
        </div>
      </div>

      {/* Hotel list */}
      <main className="max-w-xl mx-auto w-full px-4 -mt-5 pb-16">
        <div className="bg-white rounded-2xl shadow-md border border-[#E4E7EF] overflow-hidden">
          <div className="divide-y divide-[#F5F7FA]">
            {hotels.map((hotel) => (
              <Link
                key={hotel.id}
                href={`/review/${hotel.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-[#F5F7FA] transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1E243A] truncate group-hover:text-[#003580] transition-colors">
                    {hotel.name}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{hotel.location}</span>
                  </div>
                </div>
                {hotel.guestRating > 0 && (
                  <p className="text-sm font-bold text-[#003580] flex-shrink-0">{hotel.guestRating.toFixed(1)}</p>
                )}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0"
                  style={{ background: "#FFC72C" }}>
                  <ArrowRight className="w-3.5 h-3.5 text-[#1E243A]" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
