import { Suspense } from "react";
import Link from "next/link";
import { loadProperties, loadReviews } from "@/lib/data";
import { MapPin, ArrowRight, BarChart3, Sparkles } from "lucide-react";
import { generateHotelDisplayName } from "@/lib/utils";

export const dynamic = "force-dynamic";


function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-gray-200 px-5 py-4 h-20 shimmer"
        />
      ))}
    </div>
  );
}

async function HotelList() {
  const properties = loadProperties();
  const reviews = loadReviews();

  const hotels = properties.map((p) => {
    const reviewCount = reviews.filter(
      (r) => r.eg_property_id === p.eg_property_id
    ).length;
    const name = generateHotelDisplayName(p.property_description, p.city, p.country, p.star_rating);
    const location = [p.city, p.province, p.country].filter(Boolean).join(", ");
    return {
      id: p.eg_property_id,
      name,
      location,
      starRating: p.star_rating,
      guestRating: p.guestrating_avg_expedia,
      reviewCount,
    };
  });

  return (
    <div className="space-y-3">
      {hotels.map((hotel, i) => (
        <Link
          key={hotel.id}
          href={`/review/${hotel.id}`}
          className="flex items-center justify-between gap-4 bg-white rounded-2xl border border-gray-200 px-5 py-4 hover:shadow-md hover:border-[#FEBF4F] transition-all group animate-fade-in-up"
          style={{ animationDelay: `${i * 0.04}s` }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1E243A] truncate">
              {hotel.name}
            </p>
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{hotel.location}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            {hotel.guestRating > 0 && (
              <div className="text-center hidden sm:block">
                <p className="text-base font-bold text-[#1E243A]">
                  {hotel.guestRating.toFixed(1)}
                </p>
                <p className="text-xs text-gray-400">/ 10</p>
              </div>
            )}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110"
              style={{ background: "#FEBF4F" }}
            >
              <ArrowRight className="w-4 h-4 text-[#1E243A]" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
              style={{ background: "#FCDB32", color: "#1E243A" }}
            >
              E
            </div>
            <span className="font-bold text-[#1E243A] text-base">
              Ask What Matters
            </span>
          </Link>
          <Link
            href="/portfolio"
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#1E243A] transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Property Portfolio
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: "linear-gradient(160deg, #FCDB32 0%, #FCDB32 60%, #FDE97A 100%)" }}>
        <div className="max-w-3xl mx-auto px-6 py-14 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
            style={{
              background: "rgba(30,36,58,0.08)",
              color: "#1E243A",
              border: "1px solid rgba(30,36,58,0.12)",
            }}
          >
            <Sparkles className="w-3 h-3" />
            Wharton Hack-AI-thon 2026 · Expedia Group
          </div>
          <h1 className="text-4xl font-extrabold text-[#1E243A] leading-tight mb-4">
            How was your stay?
          </h1>
          <p className="text-[#1E243A]/70 text-base leading-relaxed max-w-md mx-auto">
            Share your experience and our AI will ask the follow-up questions
            that matter most, helping future travelers make better decisions.
          </p>
        </div>
      </div>

      {/* Hotel selector card */}
      <div className="max-w-3xl mx-auto px-6 -mt-6 pb-12">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Select your hotel
          </p>
          <Suspense fallback={<LoadingSkeleton />}>
            <HotelList />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
