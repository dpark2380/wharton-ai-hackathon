"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Map, Lightbulb, MessageSquare,
  BarChart3, TrendingUp, LogOut, ChevronLeft, Menu, X, Settings,
} from "lucide-react";
import { MANAGER_ACCOUNTS, MANAGER_STORAGE_KEY, type ManagerAccount } from "@/lib/manager-accounts";

const NAV = [
  { label: "Overview",      href: "",           icon: LayoutDashboard },
  { label: "Topic Coverage",href: "/topics",     icon: Map },
  { label: "Insights",      href: "/insights",   icon: Lightbulb },
  { label: "Reviews",       href: "/reviews",    icon: MessageSquare },
  { label: "Analytics",     href: "/analytics",  icon: BarChart3 },
  { label: "Trends",        href: "/trends",     icon: TrendingUp },
  { label: "Settings",      href: "/settings",   icon: Settings },
];

interface Props {
  propertyId: string;
  propertyName: string;
  city: string;
  country: string;
}

export default function PartnerSidebar({ propertyId, propertyName, city, country }: Props) {
  const pathname = usePathname();
  const base = `/property/${propertyId}`;
  const [open, setOpen] = useState(false);
  const [manager, setManager] = useState<ManagerAccount | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(MANAGER_STORAGE_KEY);
    if (stored) {
      const found = MANAGER_ACCOUNTS.find((a) => a.id === stored);
      setManager(found ?? null);
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem(MANAGER_STORAGE_KEY);
    window.location.href = "/manager";
  };

  const isActive = (href: string) => {
    const full = base + href;
    if (href === "") return pathname === base;
    return pathname.startsWith(full);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <button onClick={handleSignOut} className="block bg-white rounded-lg px-2 py-1">
          <img src="/Expedia-Logo.svg.png" alt="Expedia" className="h-8 w-auto" />
        </button>
      </div>

      {/* Property */}
      <div className="px-5 py-4 border-b border-white/10">
        <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Your property</p>
        <p className="text-white text-sm font-semibold leading-snug truncate">{propertyName}</p>
        <p className="text-white/50 text-xs mt-0.5">{city}, {country}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={base + href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "text-[#1E243A] bg-[#FFC72C]"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        {manager && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #006FCF, #003580)" }}>
              {manager.initial}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{manager.name}</p>
              <p className="text-white/40 text-[10px] truncate">{manager.title}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-3.5 h-3.5" />
          Switch property
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-56 shrink-0 sticky top-0 h-screen"
        style={{ background: "#1E243A" }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <header
        className="lg:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4 overflow-hidden bg-white border-b border-[#E4E7EF]"
      >
        <button onClick={handleSignOut} className="block">
          <img src="/Expedia-Logo.svg.png" alt="Expedia" className="h-10 w-auto" />
        </button>
        <button onClick={() => setOpen(true)} className="text-gray-400 hover:text-gray-700">
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col"
            style={{ background: "#1E243A" }}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
