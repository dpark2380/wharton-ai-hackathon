"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin, ArrowRight, LogOut, ChevronRight, BookOpen,
} from "lucide-react";
import { DEMO_ACCOUNTS, TIER_COLORS, DemoAccount } from "@/lib/accounts";
import { initAccountPoints } from "@/lib/levels";

interface Hotel {
  id: string;
  name: string;
  location: string;
  guestRating: number;
}

interface TravelerHomeProps {
  hotels: Hotel[];
}

const STORAGE_KEY = "awm_account";

// ── Helpers ───────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: DemoAccount["tier"] }) {
  const s = TIER_COLORS[tier];
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}>
      {tier}
    </span>
  );
}

function TripTypeBadge({ type }: { type: DemoAccount["tripType"] }) {
  return <span className="text-xs text-gray-400">{type}</span>;
}

// ── Logged-in view ────────────────────────────────────────────────────────────

function LoggedInView({
  account,
  hotel,
  hotels: _hotels,
  onSignOut,
}: {
  account: DemoAccount;
  hotel: Hotel | undefined;
  hotels: Hotel[];
  onSignOut: () => void;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5F7FA" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 h-14 px-6 flex items-center justify-between overflow-hidden bg-white border-b border-[#E4E7EF]">
        <Link href="/"><img src="/Expedia-Logo.svg.png" alt="Expedia" className="h-10 w-auto" /></Link>
        <button
          onClick={onSignOut}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </header>

      {/* Hero */}
      <div style={{ background: "linear-gradient(160deg, #003580 0%, #006FCF 100%)" }}>
        <div className="max-w-xl mx-auto px-4 py-10">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">
            Welcome back
          </p>
          <h1 className="text-2xl font-extrabold text-white mb-1.5">
            {account.name.split(" ")[0]}, how was your stay?
          </h1>
          <p className="text-white/70 text-sm">
            Checked out of{" "}
            <span className="font-semibold text-white">{account.recentCity}, {account.recentCountry}</span>
            {" "}· {account.checkOutDate} · {account.nightsStayed} nights
          </p>
        </div>
      </div>

      {/* Hotel card */}
      <div className="max-w-xl mx-auto w-full px-4 -mt-5 pb-20">
        {hotel ? (
          <div className="bg-white rounded-2xl shadow-md border border-[#E4E7EF] overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b border-[#E4E7EF]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[#003580] uppercase tracking-widest mb-1">
                    Your recent stay (auto-detected)
                  </p>
                  <h2 className="text-base font-bold text-[#1E243A] leading-tight">{hotel.name}</h2>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{hotel.location}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-[#F5F7FA] border-b border-[#E4E7EF] flex items-center gap-5 text-xs text-gray-500">
              <span>Check-out: <span className="font-semibold text-[#1E243A]">{account.checkOutDate}</span></span>
              <span>{account.nightsStayed} nights</span>
              <TripTypeBadge type={account.tripType} />
            </div>

            <div className="px-5 py-5">
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                Your review helps future travelers. It takes less than 2 minutes.
              </p>
              <button
                onClick={() => router.push(`/review/${hotel.id}`)}
                className="w-full py-3.5 rounded-xl text-[#1E243A] font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "#FFC72C" }}
              >
                Share Your Experience
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-center text-xs text-gray-400 mt-3">
                Not the right hotel?{" "}
                <button onClick={onSignOut} className="text-[#003580] underline underline-offset-2">
                  Search manually
                </button>
              </p>
              <Link
                href="/passport"
                className="mt-3 w-full py-3 rounded-xl border border-[#E4E7EF] text-sm font-semibold text-[#003580] flex items-center justify-center gap-2 hover:bg-[#F5F7FA] transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                View my Explorer Pass
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-[#E4E7EF] p-6 text-center">
            <p className="text-gray-500 text-sm">Could not detect your recent hotel.</p>
            <button onClick={onSignOut} className="mt-3 text-sm text-[#003580] underline underline-offset-2">
              Search manually
            </button>
          </div>
        )}
      </div>

      {/* Debug link */}
      <div className="fixed bottom-4 right-4 z-50">
        <Link
          href="/guest-debug"
          className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors px-2 py-1 rounded border border-gray-200 bg-white shadow-sm"
        >
          debug
        </Link>
      </div>
    </div>
  );
}

// ── Landing page (not logged in) ──────────────────────────────────────────────

function GuestLanding({
  hotels: _hotels,
  onSelectAccount,
}: {
  hotels: Hotel[];
  onSelectAccount: (account: DemoAccount) => void;
}) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #001f4d 0%, #003580 45%, #005bb5 100%)" }}
    >
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 h-14 px-6 flex items-center justify-between">
        <div className="bg-white rounded-lg px-2 py-1">
          <Link href="/"><img src="/Expedia-Logo.svg.png" alt="Expedia" className="h-8 w-auto" /></Link>
        </div>
        <Link href="/manager" className="text-xs text-white/50 hover:text-white transition-colors">
          Hotel Manager →
        </Link>
      </header>

      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 pt-20">
        <h1 className="text-3xl font-extrabold text-white leading-tight mb-2 text-center">
          How was your stay?
        </h1>
        <p className="text-white/60 text-sm mb-8 text-center max-w-xs leading-relaxed">
          Sign in with your Expedia account and we&apos;ll find your recent booking automatically.
        </p>

        {/* Account picker card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-lg">
          <div className="px-5 pt-5 pb-3 border-b border-[#E4E7EF]">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sign in as</p>
          </div>
          <div className="divide-y divide-[#F5F7FA]">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.id}
                onClick={() => onSelectAccount(account)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#F5F7FA] transition-colors group text-left"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #003580, #006FCF)" }}
                >
                  {account.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-[#1E243A]">{account.name}</span>
                    <TierBadge tier={account.tier} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">Recent: {account.recentCity}, {account.recentCountry}</span>
                    <span>·</span>
                    <TripTypeBadge type={account.tripType} />
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#003580] flex-shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Debug link */}
      <div className="fixed bottom-4 right-4 z-50">
        <Link
          href="/guest-debug"
          className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
        >
          debug
        </Link>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TravelerHome({ hotels }: TravelerHomeProps) {
  // account is session-only, never restored from localStorage.
  // Visiting / always shows the profile picker regardless of prior sessions.
  const [account, setAccount] = useState<DemoAccount | null>(null);

  const handleSelectAccount = (a: DemoAccount) => {
    localStorage.setItem(STORAGE_KEY, a.id); // kept for ReviewFlow compatibility
    initAccountPoints(a.id, a.startingPoints);
    setAccount(a);
  };

  const handleSignOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAccount(null);
  };

  if (account) {
    const hotel = hotels.find((h) => h.id === account.recentPropertyId);
    return <LoggedInView account={account} hotel={hotel} hotels={hotels} onSignOut={handleSignOut} />;
  }

  return <GuestLanding hotels={hotels} onSelectAccount={handleSelectAccount} />;
}
