"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Star, ArrowLeft } from "lucide-react";
import ReviewFlow from "@/components/ReviewFlow";

interface ReviewPageClientProps {
  propertyId: string;
  propertyName: string;
  city: string;
  country: string;
  starRating: number;
  location: string;
  currentHealthScore: number;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < Math.round(rating) ? "fill-[#FFC72C] text-[#FFC72C]" : "fill-white/20 text-white/20"}`}
        />
      ))}
    </div>
  );
}

export default function ReviewPageClient({
  propertyId,
  propertyName,
  city,
  country,
  starRating,
  location,
  currentHealthScore,
}: ReviewPageClientProps) {
  const [isDirty, setIsDirty] = useState(false);
  const [accountId, setAccountId] = useState("guest");
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("awm_account");
    if (stored) setAccountId(stored);
  }, []);

  const handleBack = () => {
    if (isDirty && !window.confirm("You have an unfinished review. Leave without saving?")) return;
    router.push("/");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5F7FA" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#E4E7EF]">
        <div className="max-w-xl mx-auto h-14 px-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#003580] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <Link href="/"><img src="/Expedia-Logo.svg.png" alt="Expedia" className="h-10 w-auto" /></Link>
          {/* Spacer to balance back button */}
          <div className="w-16" />
        </div>
      </header>

      {/* Property banner */}
      <div style={{ background: "linear-gradient(160deg, #003580 0%, #006FCF 100%)" }}>
        <div className="max-w-xl mx-auto px-4 py-5">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {starRating > 0 && (
                <div className="mb-1">
                  <StarRow rating={starRating} />
                </div>
              )}
              <h1 className="text-base font-bold text-white leading-tight">{propertyName}</h1>
              <div className="flex items-center gap-1 text-white/60 text-xs mt-0.5">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            </div>
            <div className="flex-shrink-0 bg-white/10 rounded-xl px-3 py-2 text-center">
              <p className="text-xs text-white/60">Your stay</p>
              <p className="text-xs font-semibold text-white">{city}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Review flow */}
      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-6">
        <ReviewFlow
          propertyId={propertyId}
          propertyName={propertyName}
          city={city}
          country={country}
          currentHealthScore={currentHealthScore}
          onDirtyChange={setIsDirty}
          accountId={accountId}
        />
      </main>
    </div>
  );
}
