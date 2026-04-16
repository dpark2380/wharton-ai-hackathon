"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MapPin, Star, ArrowRight, Bell } from "lucide-react";
import GlobalNav, { TRAVELER_STORAGE_KEY, TRAVELER_SESSION_KEY } from "@/components/GlobalNav";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/lib/accounts";

export interface HotelSummary {
  id: string;
  name: string;
  city: string;
  country: string;
  province: string;
  starRating: number;
  guestRating: number;
  description: string;
  amenities: string[];
}

// Gradient palettes keyed loosely by country/region
const COUNTRY_GRADIENTS: Record<string, [string, string]> = {
  Italy:          ["#e8836a", "#c0392b"],
  Thailand:       ["#27ae60", "#1a5276"],
  "United States":["#2980b9", "#1a5276"],
  Japan:          ["#c0392b", "#8e44ad"],
  France:         ["#8e44ad", "#2980b9"],
  Germany:        ["#2c3e50", "#3498db"],
  Australia:      ["#e67e22", "#d35400"],
  Greece:         ["#3498db", "#1abc9c"],
  Spain:          ["#e74c3c", "#f39c12"],
  Mexico:         ["#27ae60", "#f39c12"],
  Indonesia:      ["#16a085", "#27ae60"],
  Netherlands:    ["#e67e22", "#d35400"],
  Portugal:       ["#27ae60", "#2980b9"],
  "Czech Republic":["#c0392b", "#e74c3c"],
  Singapore:      ["#2ecc71", "#1abc9c"],
  default:        ["#003580", "#006FCF"],
};

function getGradient(country: string): [string, string] {
  return COUNTRY_GRADIENTS[country] ?? COUNTRY_GRADIENTS.default;
}

function StarRow({ n, size = "sm" }: { n: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "w-4 h-4" : "w-3 h-3";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${cls} ${i < n ? "fill-[#FFC72C] text-[#FFC72C]" : "fill-gray-200 text-gray-200"}`}
        />
      ))}
    </div>
  );
}

function HotelCard({ hotel, index }: { hotel: HotelSummary; index: number }) {
  const [from, to] = getGradient(hotel.country);
  const topAmenities = hotel.amenities.slice(0, 3);
  const shortDesc = hotel.description.slice(0, 90).trim();

  return (
    <Link
      href={`/hotels/${hotel.id}`}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg border border-gray-100 hover:border-gray-200 transition-all duration-300 hover:-translate-y-0.5 flex flex-col"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Color header */}
      <div
        className="h-32 flex items-end p-4 relative"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      >
        {/* Star rating badge — only shown when a classification exists */}
        {hotel.starRating > 0 && (
          <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-sm rounded-lg px-2 py-1">
            <StarRow n={Math.round(hotel.starRating)} />
          </div>
        )}
        {/* Guest rating */}
        {hotel.guestRating > 0 && (
          <div className="bg-white/95 rounded-lg px-2.5 py-1.5 text-center">
            <p className="text-lg font-black leading-none" style={{ color: from }}>
              {hotel.guestRating.toFixed(1)}
            </p>
            <p className="text-[9px] text-gray-500 font-medium leading-none mt-0.5">/10</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <div>
          <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 group-hover:text-[#003580] transition-colors">
            {hotel.name}
          </h3>
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{hotel.city}, {hotel.country}</span>
          </div>
        </div>

        {shortDesc && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{shortDesc}...</p>
        )}

        {topAmenities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topAmenities.map((a) => (
              <span key={a} className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border border-gray-100 capitalize">
                {a.replace(/_/g, " ").toLowerCase()}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-2">
          <div
            className="w-full text-xs font-semibold py-2 rounded-xl text-white text-center flex items-center justify-center gap-1.5 group-hover:brightness-110 transition-all"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
          >
            View Hotel
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </Link>
  );
}

interface HomeClientProps {
  hotels: HotelSummary[];
}

export default function HomeClient({ hotels }: HomeClientProps) {
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [hasReviewed, setHasReviewed] = useState(true); // default true to avoid flash
  const [recentHotel, setRecentHotel] = useState<HotelSummary | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Restore from sessionStorage so the review banner persists within a tab session
    // (sessionStorage is cleared on tab close, so the app always starts signed out)
    const sessionId = sessionStorage.getItem(TRAVELER_SESSION_KEY);
    if (sessionId) {
      const found = DEMO_ACCOUNTS.find((a) => a.id === sessionId);
      if (found) {
        setAccount(found);
        const reviewed = sessionStorage.getItem(`awm_reviewed_${found.id}_${found.recentPropertyId}`);
        setHasReviewed(!!reviewed);
          setRecentHotel(hotels.find((h) => h.id === found.recentPropertyId) ?? null);
        return;
      }
    }
    setHasReviewed(true);
  }, [hotels]);

  const handleAccountChange = (a: DemoAccount | null) => {
    setAccount(a);
    if (a) {
      const reviewed = sessionStorage.getItem(`awm_reviewed_${a.id}_${a.recentPropertyId}`);
      setHasReviewed(!!reviewed);
      const hotel = hotels.find((h) => h.id === a.recentPropertyId) ?? null;
      setRecentHotel(hotel);
    } else {
      setHasReviewed(true);
      setRecentHotel(null);
    }
  };

  const filtered = search.trim()
    ? hotels.filter(
        (h) =>
          h.name.toLowerCase().includes(search.toLowerCase()) ||
          h.city.toLowerCase().includes(search.toLowerCase()) ||
          h.country.toLowerCase().includes(search.toLowerCase())
      )
    : hotels;

  return (
    <div className="min-h-screen bg-gray-50">
      <GlobalNav onAccountChange={handleAccountChange} />

      {/* Hero strip */}
      <div style={{ background: "linear-gradient(135deg, #001f4d 0%, #003580 60%, #005bb5 100%)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <p className="text-[#FFC72C] text-xs font-bold uppercase tracking-widest mb-2">CompleteStayz</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-2">
            Discover hotels worth talking about
          </h1>
          <p className="text-white/60 text-sm max-w-lg mb-6">
            Browse properties and share smarter reviews that fill the gaps every traveller cares about.
          </p>
          {/* Search bar */}
          <div className="relative max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by hotel, city or country…"
              className="w-full pl-4 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:bg-white/15 focus:border-white/40 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Review prompt banner */}
      {account && !hasReviewed && recentHotel && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl border"
            style={{ background: "#FFF8E1", borderColor: "#FCDB32" }}
          >
            <Bell className="w-4 h-4 text-[#B8860B] flex-shrink-0" />
            <p className="text-sm text-[#7a5c00] flex-1 min-w-0">
              <span className="font-semibold">{account.name.split(" ")[0]}</span>, you recently stayed at{" "}
              <span className="font-semibold">{recentHotel.name}</span>. Share your experience!
            </p>
            <Link
              href={`/review/${recentHotel.id}`}
              className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg text-[#1E243A] hover:brightness-105 transition-all"
              style={{ background: "#FFC72C" }}
            >
              Write Review
            </Link>
          </div>
        </div>
      )}

      {/* Hotel grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {search ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""}` : `${hotels.length} Hotels`}
          </h2>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-semibold mb-1">No hotels found</p>
            <p className="text-sm">Try a different search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((hotel, i) => (
              <HotelCard key={hotel.id} hotel={hotel} index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
