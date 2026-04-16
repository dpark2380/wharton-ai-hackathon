"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, BookOpen, LogOut, MapPin, X } from "lucide-react";
import { DEMO_ACCOUNTS, TIER_COLORS, type DemoAccount } from "@/lib/accounts";
import { MANAGER_ACCOUNTS, MANAGER_STORAGE_KEY, type ManagerAccount } from "@/lib/manager-accounts";
import { initAccountPoints } from "@/lib/levels";

export const TRAVELER_STORAGE_KEY = "awm_account";
// Session key — cleared when the tab closes, so the app always starts signed out
export const TRAVELER_SESSION_KEY = "awm_account_session";

interface GlobalNavProps {
  /** Called when sign-in state changes (so parent can re-render review prompt etc.) */
  onAccountChange?: (account: DemoAccount | null) => void;
}

export default function GlobalNav({ onAccountChange }: GlobalNavProps) {
  const router = useRouter();
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [manager, setManager] = useState<ManagerAccount | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    // Restore traveler from sessionStorage (persists within tab, clears on close)
    const sessionId = sessionStorage.getItem(TRAVELER_SESSION_KEY);
    if (sessionId) {
      const found = DEMO_ACCOUNTS.find((a) => a.id === sessionId);
      if (found) {
        setAccount(found);
        onAccountChange?.(found);
      }
    }
    // Manager restored from localStorage (persistent login for dashboard)
    const storedManager = localStorage.getItem(MANAGER_STORAGE_KEY);
    if (storedManager) {
      const found = MANAGER_ACCOUNTS.find((a) => a.id === storedManager);
      if (found) setManager(found);
    }
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setShowSignIn(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignIn = (a: DemoAccount) => {
    localStorage.setItem(TRAVELER_STORAGE_KEY, a.id);   // for ReviewFlow
    sessionStorage.setItem(TRAVELER_SESSION_KEY, a.id); // for cross-page session
    initAccountPoints(a.id, a.startingPoints);
    setAccount(a);
    setShowSignIn(false);
    onAccountChange?.(a);
  };

  const handleSignOut = () => {
    localStorage.removeItem(TRAVELER_STORAGE_KEY);
    sessionStorage.removeItem(TRAVELER_SESSION_KEY);
    setAccount(null);
    setShowUserMenu(false);
    onAccountChange?.(null);
  };

  const managerDashboardHref = manager
    ? `/property/${manager.propertyId}`
    : "/manager";

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <img src="/Expedia-Logo.svg.png" alt="Expedia" className="h-9 w-auto" />
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Manager Dashboard button */}
            <Link
              href={managerDashboardHref}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#003580] text-[#003580] hover:bg-[#003580] hover:text-white transition-colors"
            >
              <Building2 className="w-3.5 h-3.5" />
              Manager Dashboard
            </Link>

            {/* Auth button */}
            {!mounted ? (
              <div className="w-20 h-8 rounded-lg bg-gray-100 animate-pulse" />
            ) : account ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowUserMenu((v) => !v)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #003580, #006FCF)" }}
                  >
                    {account.initial}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-semibold text-gray-800 leading-tight">{account.name.split(" ")[0]}</p>
                    <p className="text-[10px] text-gray-400 leading-tight"
                      style={{ color: TIER_COLORS[account.tier].text }}>
                      {account.tier} Member
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-800">{account.name}</p>
                      <p className="text-[10px] text-gray-400">{account.tier} Member · {account.tripType}</p>
                    </div>
                    <button
                      onClick={() => { setShowUserMenu(false); router.push("/passport"); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                    >
                      <BookOpen className="w-4 h-4 text-[#003580]" />
                      Travel Passport
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowSignIn(true)}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-[#FFC72C] text-[#1E243A] hover:brightness-105 transition-all"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Sign-in modal */}
      {showSignIn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <div ref={modalRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Demo Accounts</p>
                <h2 className="text-lg font-bold text-gray-900">Sign in as</h2>
              </div>
              <button
                onClick={() => setShowSignIn(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {DEMO_ACCOUNTS.map((a) => {
                const tierStyle = TIER_COLORS[a.tier];
                return (
                  <button
                    key={a.id}
                    onClick={() => handleSignIn(a)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left group"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #003580, #006FCF)" }}
                    >
                      {a.initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-gray-900">{a.name}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
                          style={{ background: tierStyle.bg, color: tierStyle.text, borderColor: tierStyle.border }}>
                          {a.tier}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">Last stay: {a.recentCity}, {a.recentCountry}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
