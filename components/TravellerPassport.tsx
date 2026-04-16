"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MapPin, Star, Camera, MessageSquare, Award,
  ArrowLeft, Globe, ChevronRight, Zap,
} from "lucide-react";
import { DEMO_ACCOUNTS, TIER_COLORS, type DemoAccount } from "@/lib/accounts";
import { getStoredPoints, getLevel, getNextLevel, progressToNextLevel, LEVELS } from "@/lib/levels";
import { PASSPORT_HISTORIES, type PassportStay } from "@/lib/passport-data";

const STORAGE_KEY = "awm_account";

function StarRating({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < n ? "fill-[#FFC72C] text-[#FFC72C]" : "fill-white/20 text-white/20"}`}
        />
      ))}
    </div>
  );
}

function TopicChip({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10">
      {label}
    </span>
  );
}

function StayCard({ stay, index }: { stay: PassportStay; index: number }) {
  return (
    <div className="relative flex gap-5">
      {/* Timeline spine */}
      <div className="flex flex-col items-center">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 shadow-md border-2 border-white/10"
          style={{ background: "linear-gradient(135deg, #003580, #006FCF)" }}
        >
          {stay.flag}
        </div>
        {/* connecting line — don't render on last item */}
        <div className="w-px flex-1 mt-2 bg-white/10 min-h-[16px]" />
      </div>

      {/* Card */}
      <div
        className="flex-1 mb-5 rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        {/* Card header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-white font-bold text-base leading-snug">{stay.hotelName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3 h-3 text-white/40 shrink-0" />
                <span className="text-white/50 text-xs">{stay.city}, {stay.country}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <StarRating n={stay.rating} />
              <span className="text-[10px] text-white/40 font-medium">{stay.tripType}</span>
            </div>
          </div>
          <p className="text-white/30 text-[11px] mt-2">
            {stay.checkIn} — {stay.checkOut} · {stay.nights} night{stay.nights !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Review text */}
        <div className="px-4 py-3">
          <p className="text-white/70 text-sm leading-relaxed">{stay.reviewText}</p>
        </div>

        {/* Topics + stats */}
        <div className="px-4 pb-4 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {stay.topics.map((t) => <TopicChip key={t} label={t} />)}
          </div>
          <div className="flex items-center gap-4 text-[11px] text-white/40">
            {stay.photoCount > 0 && (
              <span className="flex items-center gap-1">
                <Camera className="w-3 h-3" />
                {stay.photoCount} photo{stay.photoCount !== 1 ? "s" : ""}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#FFC72C]" />
              <span className="text-[#FFC72C] font-semibold">+{stay.pointsEarned} pts</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TravellerPassport() {
  const router = useRouter();
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [points, setPoints] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) { router.replace("/hotels"); return; }
    const found = DEMO_ACCOUNTS.find((a) => a.id === id);
    if (!found) { router.replace("/hotels"); return; }
    setAccount(found);
    setPoints(getStoredPoints(id));
  }, [router]);

  if (!mounted || !account) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg, #001f4d 0%, #003580 45%, #005bb5 100%)" }}
      >
        <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const level = getLevel(points);
  const nextLevel = getNextLevel(points);
  const progress = progressToNextLevel(points);
  const tierStyle = TIER_COLORS[account.tier];
  const history = PASSPORT_HISTORIES[account.id] ?? [];

  const totalCountries = new Set(history.map((s) => s.country)).size;
  const totalNights = history.reduce((sum, s) => sum + s.nights, 0);
  const totalPhotos = history.reduce((sum, s) => sum + s.photoCount, 0);

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #001f4d 0%, #003580 45%, #005bb5 100%)" }}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 px-4 py-4 flex items-center justify-between border-b border-white/10 backdrop-blur-sm"
        style={{ background: "rgba(0,21,77,0.7)" }}>
        <Link
          href="/hotels"
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="bg-white rounded-lg px-2 py-1">
          <img src="/Expedia-Logo.svg.png" alt="Expedia" className="h-7 w-auto" />
        </div>
        <div className="w-16" /> {/* spacer */}
      </header>

      <div className="max-w-lg mx-auto px-4 pb-16">

        {/* Passport cover card */}
        <div
          className="mt-6 rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
          style={{ background: "linear-gradient(160deg, #002060 0%, #003580 100%)" }}
        >
          {/* Cover top bar */}
          <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFC72C]">
                Expedia
              </p>
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/40 mt-0.5">
                Explorer Pass
              </p>
            </div>
            <Globe className="w-5 h-5 text-white/20" />
          </div>

          {/* Profile section */}
          <div className="px-6 py-5 flex items-center gap-5">
            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-white shrink-0 border-2 border-white/10"
              style={{ background: "linear-gradient(135deg, #006FCF, #0050A0)" }}
            >
              {account.initial}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-extrabold text-white leading-tight">{account.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="text-xs font-bold px-2.5 py-0.5 rounded-full border"
                  style={{ background: tierStyle.bg, color: tierStyle.text, borderColor: tierStyle.border }}
                >
                  {account.tier}
                </span>
                <span
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: level.color + "25", color: level.color, border: `1px solid ${level.color}40` }}
                >
                  Level {level.level} · {level.name}
                </span>
              </div>
              <p className="text-white/40 text-xs mt-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                {account.recentCity}, {account.recentCountry}
              </p>
            </div>
          </div>

          {/* Points + level progress */}
          <div className="px-6 pb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-white/50">
                <span className="text-white font-bold text-base">{points.toLocaleString()}</span> points
              </span>
              {nextLevel && (
                <span className="text-[11px] text-white/40">
                  {(nextLevel.minPoints - points).toLocaleString()} to {nextLevel.name}
                </span>
              )}
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.round(progress * 100)}%`, background: level.color }}
              />
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-4 border-t border-white/10">
            {[
              { label: "Stays", value: history.length },
              { label: "Countries", value: totalCountries },
              { label: "Nights", value: totalNights },
              { label: "Photos", value: totalPhotos },
            ].map(({ label, value }, i) => (
              <div
                key={label}
                className={`py-4 text-center ${i < 3 ? "border-r border-white/10" : ""}`}
              >
                <p className="text-white font-bold text-lg leading-none">{value}</p>
                <p className="text-white/40 text-[10px] mt-1 uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Perks banner */}
        {level.perks.length > 0 && (
          <div className="mt-4 rounded-2xl border border-white/10 px-4 py-3"
            style={{ background: level.color + "15" }}>
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4" style={{ color: level.color }} />
              <p className="text-xs font-bold" style={{ color: level.color }}>
                Your {level.name} perks
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {level.perks.map((p) => (
                <span
                  key={p.title}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                  style={{ background: level.color + "20", color: level.color, border: `1px solid ${level.color}30` }}
                >
                  {p.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Travel history */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-5">
            <MessageSquare className="w-4 h-4 text-white/40" />
            <h2 className="text-white font-bold text-sm uppercase tracking-wide">Travel History</h2>
            <span className="text-xs text-white/40 ml-auto">{history.length} stays</span>
          </div>

          {history.length === 0 ? (
            <div className="rounded-2xl border border-white/10 px-6 py-10 text-center">
              <p className="text-white/40 text-sm">No stays yet. Complete a review to stamp your passport.</p>
            </div>
          ) : (
            <div>
              {[...history].reverse().map((stay, i) => (
                <StayCard key={stay.id} stay={stay} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* Next level teaser */}
        {nextLevel && (
          <div className="mt-2 rounded-2xl border border-white/10 px-5 py-4"
            style={{ background: "rgba(255,255,255,0.04)" }}>
            <p className="text-white/50 text-xs mb-1">Next milestone</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold">Level {nextLevel.level} · {nextLevel.name}</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {nextLevel.perks[nextLevel.perks.length - 1]?.title ?? "More perks"} unlocks
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/20" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
