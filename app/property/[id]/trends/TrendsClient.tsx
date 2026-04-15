"use client";

import { useState, useEffect } from "react";

interface DataPoint {
  period: string;
  overall: number;
  [topicId: string]: number | string;
}

const TOPIC_LABELS: Record<string, string> = {
  cleanliness: "Cleanliness",
  location: "Location",
  food_breakfast: "Food & Breakfast",
  wifi_internet: "WiFi",
  parking: "Parking",
  pool_fitness: "Pool & Fitness",
  checkin_checkout: "Check-in",
  noise: "Noise",
  room_comfort: "Room Comfort",
  bathroom: "Bathroom",
  staff_service: "Staff & Service",
  value: "Value",
  spa_wellness: "Spa & Wellness",
  accessibility: "Accessibility",
  eco_sustainability: "Eco",
};

const TOPIC_IDS = Object.keys(TOPIC_LABELS);

export default function TrendsClient({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [granularity, setGranularity] = useState<"monthly" | "yearly">("monthly");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/satisfaction-trend?propertyId=${encodeURIComponent(propertyId)}&granularity=${granularity}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [propertyId, granularity]);

  // Simple SVG line chart, no external dependency needed
  const width = 600;
  const height = 200;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 32;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  function toPath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return "";
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
  }

  function buildLine(key: string, dataArr: DataPoint[]): { x: number; y: number }[] {
    return dataArr
      .map((d, i) => {
        const val = d[key];
        if (typeof val !== "number" || isNaN(val)) return null;
        const x = padLeft + (i / Math.max(dataArr.length - 1, 1)) * chartW;
        const y = padTop + (1 - val) * chartH;
        return { x, y };
      })
      .filter(Boolean) as { x: number; y: number }[];
  }

  const overallPts = buildLine("overall", data);
  const topicPts = selectedTopic ? buildLine(selectedTopic, data) : [];

  const topicsWithData = TOPIC_IDS.filter((t) =>
    data.some((d) => typeof d[t] === "number" && !isNaN(d[t] as number))
  );

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {(["monthly", "yearly"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                granularity === g
                  ? "text-white"
                  : "text-gray-500 hover:text-[#1E243A] bg-gray-100"
              }`}
              style={granularity === g ? { background: "#003580" } : {}}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
        {selectedTopic && (
          <button
            onClick={() => setSelectedTopic(null)}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Clear topic overlay
          </button>
        )}
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-52 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#003580] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length < 2 ? (
        <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
          Not enough data to show trends yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-full" style={{ minWidth: 280 }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((v) => {
              const y = padTop + (1 - v) * chartH;
              return (
                <g key={v}>
                  <line x1={padLeft} x2={padLeft + chartW} y1={y} y2={y}
                    stroke="#E4E7EF" strokeWidth="1" />
                  <text x={padLeft - 6} y={y + 4} textAnchor="end"
                    fontSize="9" fill="#94a3b8">
                    {Math.round(v * 100)}
                  </text>
                </g>
              );
            })}

            {/* X axis labels */}
            {data.map((d, i) => {
              if (data.length > 12 && i % Math.ceil(data.length / 8) !== 0) return null;
              const x = padLeft + (i / Math.max(data.length - 1, 1)) * chartW;
              return (
                <text key={i} x={x} y={height - 4} textAnchor="middle"
                  fontSize="8" fill="#94a3b8">
                  {d.period}
                </text>
              );
            })}

            {/* Overall line */}
            <path
              d={toPath(overallPts)}
              fill="none"
              stroke="#003580"
              strokeWidth={selectedTopic ? "1.5" : "2.5"}
              opacity={selectedTopic ? 0.3 : 1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Topic overlay */}
            {topicPts.length > 1 && (
              <path
                d={toPath(topicPts)}
                fill="none"
                stroke="#FFC72C"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Legend */}
            <g>
              <circle cx={padLeft + 6} cy={padTop + 6} r="4" fill="#003580" opacity={selectedTopic ? 0.3 : 1} />
              <text x={padLeft + 14} y={padTop + 10} fontSize="9" fill="#64748b">Overall</text>
              {selectedTopic && (
                <>
                  <circle cx={padLeft + 60} cy={padTop + 6} r="4" fill="#FFC72C" />
                  <text x={padLeft + 68} y={padTop + 10} fontSize="9" fill="#64748b">
                    {TOPIC_LABELS[selectedTopic]}
                  </text>
                </>
              )}
            </g>
          </svg>
        </div>
      )}

      {/* Topic pills */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Overlay a topic</p>
        <div className="flex flex-wrap gap-1.5">
          {TOPIC_IDS.map((t) => {
            const hasData = topicsWithData.includes(t);
            const active = selectedTopic === t;
            return (
              <button
                key={t}
                onClick={() => setSelectedTopic(active ? null : t)}
                disabled={!hasData}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                  active
                    ? "text-[#1E243A]"
                    : hasData
                    ? "text-gray-600 bg-gray-100 hover:bg-gray-200"
                    : "text-gray-300 bg-gray-50 cursor-not-allowed"
                }`}
                style={active ? { background: "#FFC72C" } : {}}
              >
                {TOPIC_LABELS[t]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
