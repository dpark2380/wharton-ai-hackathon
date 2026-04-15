"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, ThumbsUp, TrendingUp, Lightbulb } from "lucide-react";

interface InsightsData {
  summary: string;
  issues: string;
  strengths: string;
  trend: string;
}

// ── Individual card ────────────────────────────────────────────────────────────

function InsightCard({
  icon,
  title,
  text,
  bg,
  border,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  bg: string;
  border: string;
}) {
  if (!text) return null;
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: bg, borderColor: border }}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-bold text-[#1a1a2e]">{title}</h3>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border border-[#e5e0d8] bg-white p-5">
          <div className="h-4 w-32 bg-gray-100 rounded mb-3" />
          <div className="space-y-2">
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-5/6" />
            <div className="h-3 bg-gray-100 rounded w-4/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PropertyInsights({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch("/api/generate-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) return <Skeleton />;

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-600">Could not generate insights. Check your OpenAI key and try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          AI-generated · based on recent review corpus · weighted toward last 90 days
        </span>
      </div>

      <InsightCard
        icon={<Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />}
        title="At a Glance"
        text={data.summary}
        bg="#fffbeb"
        border="#fde68a"
      />

      <InsightCard
        icon={<AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
        title="Top Issues to Address"
        text={data.issues}
        bg="#fef2f2"
        border="#fecaca"
      />

      <InsightCard
        icon={<ThumbsUp className="w-4 h-4 text-green-600 flex-shrink-0" />}
        title="What Guests Love"
        text={data.strengths}
        bg="#f0fdf4"
        border="#bbf7d0"
      />

      <InsightCard
        icon={<TrendingUp className="w-4 h-4 text-blue-500 flex-shrink-0" />}
        title="Recent Trend"
        text={data.trend}
        bg="#eff6ff"
        border="#bfdbfe"
      />
    </div>
  );
}
