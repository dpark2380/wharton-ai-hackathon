"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Star } from "lucide-react";
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
          className={`w-4 h-4 ${i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`}
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
  const router = useRouter();

  const handleHomeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isDirty) {
      e.preventDefault();
      if (window.confirm("You have an unfinished review. Leave without saving?")) {
        router.push("/");
      }
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#faf8f5" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <a href="/" onClick={handleHomeClick} className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
              style={{ background: "#FCDB32", color: "#1E243A" }}
            >
              E
            </div>
            <span className="font-bold text-[#1E243A] text-sm">Ask What Matters</span>
          </a>
          <a
            href="/"
            onClick={handleHomeClick}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#1E243A] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Change hotel
          </a>
        </div>
      </header>

      {/* Property context */}
      <div style={{ background: "linear-gradient(160deg, #FCDB32 0%, #FCDB32 60%, #FDE97A 100%)" }}>
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl font-bold"
              style={{ background: "#1E243A", color: "#FCDB32" }}
            >
              {(propertyName[0] || "H").toUpperCase()}
            </div>
            <div>
              {starRating > 0 && (
                <div className="mb-0.5">
                  <StarRow rating={starRating} />
                </div>
              )}
              <h1 className="text-lg font-bold text-[#1E243A] leading-tight">{propertyName}</h1>
              <div className="flex items-center gap-1 text-[#1E243A]/60 text-sm">
                <MapPin className="w-3 h-3" />
                <span>{location}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review flow */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        <ReviewFlow
          propertyId={propertyId}
          propertyName={propertyName}
          city={city}
          country={country}
          currentHealthScore={currentHealthScore}
          onDirtyChange={setIsDirty}
        />
      </main>
    </div>
  );
}
