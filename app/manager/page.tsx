"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Star, ChevronRight, LogOut, BarChart3 } from "lucide-react";
import { MANAGER_ACCOUNTS, MANAGER_STORAGE_KEY, type ManagerAccount } from "@/lib/manager-accounts";

// ── Star row ──────────────────────────────────────────────────────────────────

function StarRow({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < n ? "fill-[#FFC72C] text-[#FFC72C]" : "fill-gray-200 text-gray-200"}`}
        />
      ))}
    </div>
  );
}

// ── Logged-in redirect splash ──────────────────────────────────────────────────

function LoggedInSplash({
  account,
  onSignOut,
}: {
  account: ManagerAccount;
  onSignOut: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.push(`/property/${account.propertyId}`);
    }, 1200);
    return () => clearTimeout(t);
  }, [account.propertyId, router]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5F7FA" }}>
      <header className="h-14 px-6 flex items-center justify-between overflow-hidden bg-white border-b border-[#E4E7EF]">
        <div className="flex items-center gap-2">
          <Link href="/manager"><img src="/Expedia-Logo.svg.png" alt="Expedia" className="h-10 w-auto" /></Link>
        </div>
        <button
          onClick={onSignOut}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Switch account
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-xl font-black text-white"
            style={{ background: "linear-gradient(135deg, #003580, #006FCF)" }}>
            {account.initial}
          </div>
          <p className="text-sm text-gray-500 mb-1">Signing in as</p>
          <p className="font-bold text-[#1E243A] text-lg">{account.name}</p>
          <p className="text-sm text-gray-400 mb-6">{account.propertyName}</p>
          <div className="flex items-center justify-center gap-2 text-sm text-[#003580]">
            <div className="w-4 h-4 border-2 border-[#003580] border-t-transparent rounded-full animate-spin" />
            Loading your dashboard…
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hotel selection (login) ───────────────────────────────────────────────────

function LoginPage({ onSelect }: { onSelect: (a: ManagerAccount) => void }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5F7FA" }}>
      {/* Header */}
      <header className="h-14 px-6 flex items-center justify-between overflow-hidden bg-white border-b border-[#E4E7EF]">
        <div className="flex items-center gap-2">
          <Link href="/manager"><img src="/Expedia-Logo.svg.png" alt="Expedia" className="h-10 w-auto" /></Link>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← Guest view
        </Link>
      </header>

      {/* Hero */}
      <div style={{ background: "linear-gradient(160deg, #003580 0%, #006FCF 100%)" }} className="px-6 py-14 text-center">
        <p className="text-[#FFC72C] text-xs font-bold uppercase tracking-widest mb-3">
          Expedia Partner Central
        </p>
        <h1 className="text-3xl font-extrabold text-white mb-2 leading-tight">
          Welcome back
        </h1>
        <p className="text-white/70 text-sm max-w-xs mx-auto">
          Select your property to access your dashboard.
        </p>
      </div>

      {/* Account selector */}
      <div className="flex-1 max-w-lg mx-auto w-full px-6 -mt-5 pb-16">
        <div className="bg-white rounded-2xl shadow-lg border border-[#E4E7EF] overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-[#E4E7EF]">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Sign in as
            </p>
          </div>
          <div className="divide-y divide-[#F5F7FA]">
            {MANAGER_ACCOUNTS.map((account) => (
              <button
                key={account.id}
                onClick={() => onSelect(account)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[#F5F7FA] transition-colors group text-left"
              >
                {/* Avatar */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #003580, #006FCF)" }}
                >
                  {account.initial}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1E243A]">{account.name}</p>
                  <p className="text-xs text-gray-400">{account.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StarRow n={account.starRating} />
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{account.propertyName} · {account.city}</span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#003580] transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Debug link */}
        <div className="fixed bottom-5 right-5">
          <Link
            href="/debug"
            className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors px-2 py-1 rounded border border-gray-200 bg-white"
          >
            debug
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ManagerPage() {
  const [account, setAccount] = useState<ManagerAccount | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(MANAGER_STORAGE_KEY);
    if (stored) {
      const found = MANAGER_ACCOUNTS.find((a) => a.id === stored);
      if (found) setAccount(found);
    }
  }, []);

  const handleSelect = (a: ManagerAccount) => {
    localStorage.setItem(MANAGER_STORAGE_KEY, a.id);
    setAccount(a);
  };

  const handleSignOut = () => {
    localStorage.removeItem(MANAGER_STORAGE_KEY);
    setAccount(null);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F5F7FA" }}>
        <div className="w-8 h-8 border-2 border-[#003580] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (account) {
    return <LoggedInSplash account={account} onSignOut={handleSignOut} />;
  }

  return <LoginPage onSelect={handleSelect} />;
}
