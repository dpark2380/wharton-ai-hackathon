"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Star, MapPin, Award, Lock, Plane, Calendar, Moon, Hotel, MessageSquare, Sparkles } from "lucide-react";
import GlobalNav, { TRAVELER_SESSION_KEY } from "@/components/GlobalNav";
import { DEMO_ACCOUNTS, TIER_COLORS, type DemoAccount } from "@/lib/accounts";
import { PASSPORT_HISTORIES, type PassportStay } from "@/lib/passport-data";
import {
  LEVELS,
  getLevel,
  getNextLevel,
  progressToNextLevel,
  getStoredPoints,
  type Perk,
} from "@/lib/levels";

// ── City coordinate database (lat/lon for react-simple-maps) ──────────────────

const CITY_COORDS: Record<string, [number, number]> = {
  "Tokyo":         [139.69,  35.68],
  "Singapore":     [103.82,   1.35],
  "Berlin":        [ 13.40,  52.52],
  "Paris":         [  2.35,  48.85],
  "Pompei":        [ 14.50,  40.75],
  "Orlando":       [-81.38,  28.54],
  "Cancun":        [-86.85,  21.16],
  "London":        [ -0.12,  51.51],
  "Sydney":        [151.21, -33.87],
  "Broomfield":    [-105.09, 39.92],
  "Amsterdam":     [  4.90,  52.37],
  "Lisbon":        [ -9.14,  38.72],
  "Bangkok":       [100.52,  13.75],
  "Venice":        [ 12.32,  45.44],
  "Santorini":     [ 25.44,  36.39],
  "Prague":        [ 14.42,  50.08],
  "Nusa Dua":      [115.23,  -8.80],
  "Rome":          [ 12.48,  41.90],
  "San Francisco": [-122.42, 37.77],
  "Monterey":      [-121.89, 36.60],
};

// ── Topic labels ──────────────────────────────────────────────────────────────

const TOPIC_LABELS: Record<string, string> = {
  cleanliness:      "Cleanliness",
  location:         "Location",
  food_breakfast:   "Food & Breakfast",
  wifi_internet:    "WiFi",
  parking:          "Parking",
  pool_fitness:     "Pool & Fitness",
  checkin_checkout: "Check-in",
  noise:            "Noise",
  room_comfort:     "Room Comfort",
  bathroom:         "Bathroom",
  staff_service:    "Staff & Service",
  value:            "Value",
  spa_wellness:     "Spa & Wellness",
  accessibility:    "Accessibility",
  eco_sustainability: "Eco",
};

// ── Country flag lookup ───────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  "Japan": "🇯🇵", "Singapore": "🇸🇬", "Germany": "🇩🇪", "France": "🇫🇷",
  "Italy": "🇮🇹", "United States": "🇺🇸", "Mexico": "🇲🇽", "United Kingdom": "🇬🇧",
  "Australia": "🇦🇺", "Netherlands": "🇳🇱", "Portugal": "🇵🇹", "Thailand": "🇹🇭",
  "Greece": "🇬🇷", "Czech Republic": "🇨🇿", "Indonesia": "🇮🇩", "Spain": "🇪🇸",
};

// ── Live review record (saved to sessionStorage by ReviewFlow) ────────────────

interface LiveReviewRecord {
  id: string;
  propertyId: string;
  hotelName: string;
  city: string;
  country: string;
  rating: number;
  reviewText: string;
  topicIds: string[];
  photoCount: number;
  pointsEarned: number;
  submittedAt: string;
}

function LiveReviewCard({ record }: { record: LiveReviewRecord }) {
  const [expanded, setExpanded] = useState(false);
  const MAX = 160;
  const needsTruncate = record.reviewText.length > MAX;
  const displayText = expanded || !needsTruncate
    ? record.reviewText
    : record.reviewText.slice(0, MAX) + "…";
  const flag = COUNTRY_FLAGS[record.country] ?? "🏨";
  const submittedDate = new Date(record.submittedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="bg-white rounded-xl border border-[#003580]/20 p-4 hover:shadow-sm transition-all ring-1 ring-[#003580]/10">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[#EFF6FF] border border-[#003580]/10 flex items-center justify-center text-xl flex-shrink-0 select-none">
          {flag}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-gray-900 leading-tight">{record.hotelName}</p>
                <span className="text-[9px] font-bold text-[#003580] bg-[#EFF6FF] px-1.5 py-0.5 rounded-full">NEW</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span>{record.city}, {record.country}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < record.rating ? "fill-[#FFC72C] text-[#FFC72C]" : "fill-gray-200 text-gray-200"}`} />
                ))}
              </div>
              <span className="text-[10px] font-semibold text-[#003580] bg-[#EFF6FF] px-1.5 py-0.5 rounded-full">
                +{record.pointsEarned} pts
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400">
            <Calendar className="w-3 h-3" />
            <span>Reviewed {submittedDate}</span>
            {record.photoCount > 0 && (
              <span className="ml-2">&middot; {record.photoCount} photo{record.photoCount !== 1 ? "s" : ""}</span>
            )}
          </div>

          {record.reviewText && (
            <div className="mt-2">
              <p className="text-xs text-gray-600 leading-relaxed italic">"{displayText}"</p>
              {needsTruncate && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-[10px] text-[#003580] font-medium mt-0.5 hover:underline"
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}

          {record.topicIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {record.topicIds.slice(0, 5).map((t) => (
                <span key={t} className="text-[10px] bg-[#EFF6FF] text-[#1D4ED8] px-2 py-0.5 rounded-full border border-[#BFDBFE]">
                  {TOPIC_LABELS[t] ?? t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Lazy-load the map (avoids SSR issues with d3-geo) ─────────────────────────

interface CityPin { city: string; country: string; flag: string }

const WorldMapComponent = dynamic(() => import("@/components/WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-52 bg-[#d4e9f7] rounded-2xl flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#003580] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

// ── StayCard component ────────────────────────────────────────────────────────

function StayCard({ stay }: { stay: PassportStay }) {
  const [expanded, setExpanded] = useState(false);
  const MAX = 160;
  const needsTruncate = stay.reviewText.length > MAX;
  const displayText = expanded || !needsTruncate
    ? stay.reviewText
    : stay.reviewText.slice(0, MAX) + "…";

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-xl flex-shrink-0 select-none">
          {stay.flag}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">{stay.hotelName}</p>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span>{stay.city}, {stay.country}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < stay.rating ? "fill-[#FFC72C] text-[#FFC72C]" : "fill-gray-200 text-gray-200"}`} />
                ))}
              </div>
              <span className="text-[10px] font-semibold text-[#003580] bg-[#EFF6FF] px-1.5 py-0.5 rounded-full">
                +{stay.pointsEarned} pts
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {stay.checkIn} → {stay.checkOut}
            </span>
            <span className="flex items-center gap-1">
              <Moon className="w-3 h-3" />
              {stay.nights} {stay.nights === 1 ? "night" : "nights"}
            </span>
            <span className="capitalize">{stay.tripType}</span>
          </div>

          {stay.reviewText && (
            <div className="mt-2">
              <p className="text-xs text-gray-600 leading-relaxed italic">"{displayText}"</p>
              {needsTruncate && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-[10px] text-[#003580] font-medium mt-0.5 hover:underline"
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}

          {stay.topics.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {stay.topics.map((t) => (
                <span key={t} className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border border-gray-100">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PerkCard ──────────────────────────────────────────────────────────────────

function PerkCard({ perk, unlocked }: { perk: Perk; unlocked: boolean }) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
        unlocked ? "bg-white border-gray-100" : "bg-gray-50 border-gray-100 opacity-50"
      }`}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${unlocked ? "bg-[#EFF6FF]" : "bg-gray-100"}`}>
        {unlocked ? (
          <Award className="w-3.5 h-3.5 text-[#003580]" />
        ) : (
          <Lock className="w-3.5 h-3.5 text-gray-400" />
        )}
      </div>
      <div>
        <p className={`text-xs font-semibold ${unlocked ? "text-gray-900" : "text-gray-400"}`}>{perk.title}</p>
        <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">{perk.description}</p>
      </div>
    </div>
  );
}

// ── Main passport page ────────────────────────────────────────────────────────

export default function PassportPage() {
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [points, setPoints] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [liveReviews, setLiveReviews] = useState<LiveReviewRecord[]>([]);

  useEffect(() => {
    setMounted(true);
    const sessionId = sessionStorage.getItem(TRAVELER_SESSION_KEY);
    if (sessionId) {
      const found = DEMO_ACCOUNTS.find((a) => a.id === sessionId);
      if (found) {
        setAccount(found);
        setPoints(getStoredPoints(found.id) || found.startingPoints);
        // Load any reviews submitted this session
        const raw = sessionStorage.getItem(`awm_live_reviews_${found.id}`);
        if (raw) {
          try { setLiveReviews(JSON.parse(raw)); } catch { /* ignore */ }
        }
      }
    }
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GlobalNav />
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#003580] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GlobalNav />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mx-auto mb-4">
            <Plane className="w-8 h-8 text-[#003580]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Explorer Pass</h1>
          <p className="text-gray-500 text-sm mb-6">
            Sign in to see your travel history, reviewer status, and perks.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-[#1E243A]"
            style={{ background: "#FFC72C" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Hotels
          </Link>
        </div>
      </div>
    );
  }

  const stays = PASSPORT_HISTORIES[account.id] ?? [];
  const level = getLevel(points);
  const nextLevel = getNextLevel(points);
  const progress = progressToNextLevel(points);
  const tierStyle = TIER_COLORS[account.tier];

  // Stats — combine static history + live reviews submitted this session
  const totalNights = stays.reduce((s, h) => s + h.nights, 0);
  const totalPhotos = stays.reduce((s, h) => s + h.photoCount, 0) + liveReviews.reduce((s, r) => s + r.photoCount, 0);
  const hotelsVisited = stays.length + liveReviews.length;
  const reviewsLeft = stays.filter((s) => s.reviewText.trim().length > 0).length + liveReviews.length;

  // Map pins — include cities from live reviews too
  const seenCities = new Set<string>();
  const pins: CityPin[] = [];
  for (const s of stays) {
    if (CITY_COORDS[s.city] && !seenCities.has(s.city)) {
      seenCities.add(s.city);
      pins.push({ city: s.city, country: s.country, flag: s.flag });
    }
  }
  for (const r of liveReviews) {
    if (CITY_COORDS[r.city] && !seenCities.has(r.city)) {
      seenCities.add(r.city);
      pins.push({ city: r.city, country: r.country, flag: COUNTRY_FLAGS[r.country] ?? "🏨" });
    }
  }

  // Perks
  const unlockedLevels = LEVELS.filter((l) => l.level <= level.level);
  const allPerks: { perk: Perk; unlocked: boolean }[] = [];
  const seenTitles = new Set<string>();
  for (const l of unlockedLevels) {
    for (const p of l.perks) {
      if (!seenTitles.has(p.title)) {
        seenTitles.add(p.title);
        allPerks.push({ perk: p, unlocked: true });
      }
    }
  }
  if (nextLevel) {
    for (const p of nextLevel.perks) {
      if (!seenTitles.has(p.title)) {
        seenTitles.add(p.title);
        allPerks.push({ perk: p, unlocked: false });
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <GlobalNav />

      {/* Header banner */}
      <div style={{ background: "linear-gradient(135deg, #001f4d 0%, #003580 60%, #005bb5 100%)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white/80 transition-colors mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Hotels
          </Link>

          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              {account.initial}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-xl font-extrabold text-white">{account.name}</h1>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                  style={{ background: tierStyle.bg, color: tierStyle.text, borderColor: tierStyle.border }}
                >
                  {account.tier}
                </span>
              </div>
              <p className="text-white/60 text-sm">{account.tripType} Traveller · {stays.length} stays · {totalNights} nights</p>
            </div>

            <div className="flex-shrink-0 bg-white/10 rounded-xl px-4 py-2.5 text-center">
              <p className="text-2xl font-black text-white leading-none">{points.toLocaleString()}</p>
              <p className="text-[10px] text-white/50 mt-0.5">Review Points</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Hotels & Reviews stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
              <Hotel className="w-4.5 h-4.5 text-[#003580]" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 leading-none">{hotelsVisited}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Hotels Visited</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FFF8E1] flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4.5 h-4.5 text-[#B8860B]" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 leading-none">{reviewsLeft}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Reviews Left</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
              <Moon className="w-4.5 h-4.5 text-[#16a34a]" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 leading-none">{totalNights}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Nights Stayed</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FDF4FF] flex items-center justify-center flex-shrink-0">
              <Star className="w-4.5 h-4.5 text-[#9333ea]" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 leading-none">{totalPhotos}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Photos Shared</p>
            </div>
          </div>
        </div>

        {/* Map */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#003580]" />
            Your Travel Map
            <span className="text-gray-400 font-normal text-xs">({pins.length} {pins.length === 1 ? "destination" : "destinations"})</span>
          </h2>
          <WorldMapComponent pins={pins} cityCoords={CITY_COORDS} />
        </div>

        {/* Level status */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Reviewer Status</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                  style={{ background: level.color }}
                >
                  {level.level}
                </div>
                <div>
                  <p className="text-lg font-extrabold leading-tight" style={{ color: level.color }}>
                    {level.name}
                  </p>
                  <p className="text-xs text-gray-400">Level {level.level}</p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-2xl font-black text-gray-900 leading-none">{points.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Total Points</p>
            </div>
          </div>

          {nextLevel && (
            <div>
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                <span>{points.toLocaleString()} pts</span>
                <span>{nextLevel.name} at {nextLevel.minPoints.toLocaleString()} pts</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.round(progress * 100)}%`,
                    background: `linear-gradient(90deg, ${level.color}, ${nextLevel.color})`,
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                {(nextLevel.minPoints - points).toLocaleString()} pts to {nextLevel.name}
              </p>
            </div>
          )}
        </div>

        {/* Perks */}
        {allPerks.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#003580]" />
              Your Perks
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {allPerks.map(({ perk, unlocked }) => (
                <PerkCard key={perk.title} perk={perk} unlocked={unlocked} />
              ))}
            </div>
          </div>
        )}

        {/* Review history */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-[#FFC72C]" />
            Review History
          </h2>

          {/* Live reviews from this session */}
          {liveReviews.length > 0 && (
            <div className="mb-3 space-y-3">
              <p className="text-[10px] font-bold text-[#003580] uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Submitted this session
              </p>
              {liveReviews.map((r) => (
                <LiveReviewCard key={r.id} record={r} />
              ))}
              {stays.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Past Stays</p>
                </div>
              )}
            </div>
          )}

          {stays.length === 0 && liveReviews.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
              <p className="text-sm">No stays yet. Start exploring and reviewing!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stays.map((stay) => (
                <StayCard key={stay.id} stay={stay} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
