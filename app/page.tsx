"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, User, Sparkles } from "lucide-react";
import { MANAGER_ACCOUNTS, MANAGER_STORAGE_KEY, type ManagerAccount } from "@/lib/manager-accounts";


export default function LandingPage() {
  const [manager, setManager] = useState<ManagerAccount | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(MANAGER_STORAGE_KEY);
    if (stored) {
      const found = MANAGER_ACCOUNTS.find((a) => a.id === stored);
      setManager(found ?? null);
    }
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #001f4d 0%, #003580 45%, #005bb5 100%)" }}
    >
      {/* Background radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 10%, rgba(0,111,207,0.45) 0%, transparent 70%)",
        }}
      />

      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Nav */}
      <header className="absolute top-0 left-0 right-0 z-10 px-6 py-5 flex items-center">
        <div className="bg-white rounded-lg px-2 py-1">
          <img src="/Expedia-Logo.svg.png" alt="Expedia" className="h-8 w-auto" />
        </div>
      </header>

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center pb-24">

        {/* Badge */}
        <div
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 border border-white/20 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ background: "rgba(255,255,255,0.08)", color: "#FFC72C", transitionDelay: "0ms" }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Powered by GPT-4o-mini · MiniLM · DistilBERT
        </div>

        {/* Title */}
        <h1
          className={`text-9xl font-extrabold text-white leading-tight tracking-tight mb-4 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "60ms" }}
        >
          Complete<span style={{ color: "#FFC72C" }}>Stayz</span>
        </h1>

        <p
          className={`text-base font-medium italic tracking-wide mb-5 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ color: "#FFC72C", transitionDelay: "100ms" }}
        >
          A journey to better travel insights
        </p>

        <p
          className={`text-white/60 text-lg max-w-lg leading-relaxed mb-12 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "160ms" }}
        >
          Smarter hotel reviews that fill the gaps standard platforms miss, so every stay is fully understood.
        </p>

        {/* CTAs */}
        <div
          className={`flex flex-col sm:flex-row gap-4 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "220ms" }}
        >
          <Link
            href="/hotels"
            className="flex items-center gap-3 px-9 py-4 rounded-2xl font-semibold text-[#1E243A] transition-all hover:scale-[1.02] active:scale-[0.98] hover:brightness-105 shadow-lg text-base"
            style={{ background: "#FFC72C", minWidth: 230 }}
          >
            <User className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1 text-left">I&apos;m a traveler</span>
            <ArrowRight className="w-4 h-4 flex-shrink-0" />
          </Link>

          <Link
            href="/manager"
            className="flex flex-col px-9 py-4 rounded-2xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg border border-white/20 hover:border-white/40 text-base"
            style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)", minWidth: 230 }}
          >
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 text-left">I&apos;m a hotel manager</span>
              <ArrowRight className="w-4 h-4 flex-shrink-0" />
            </div>
            {manager && (
              <p className="text-xs text-white/50 mt-1.5 ml-8 font-normal">
                Continue as {manager.name}
              </p>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
