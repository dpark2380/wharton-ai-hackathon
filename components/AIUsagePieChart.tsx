"use client";

// Cost estimates based on OpenAI published pricing (April 2025):
//   GPT-4o-mini:  $0.150 / 1M input tokens,  $0.600 / 1M output tokens
//   GPT-4o:       $2.500 / 1M input tokens,  $10.00 / 1M output tokens
//
// Runtime proportions are token-weighted across a representative session
// (10 guest reviews, 8 photos uploaded, 5 topic insight panels opened).

interface Feature {
  label: string;
  description: string;
  model: string;
  costLabel: string;
  color: string;
  tokenShare?: number; // percentage of runtime GPT token usage
}

const RUNTIME_FEATURES: Feature[] = [
  {
    label: "Topic Insights",
    description:
      "GPT-4o-mini reads the 35 most recent relevant reviews and returns a structured plain-English briefing (summary, issues, strengths, trend). Cached per topic for the session lifetime.",
    model: "GPT-4o-mini",
    costLabel: "~$0.00084 / panel open",
    color: "#003580",
    tokenShare: 61,
  },
  {
    label: "Follow-up Questions",
    description:
      "After each guest review, GPT-4o-mini writes 2 contextual follow-up questions targeting the hotel's most urgent knowledge gaps. Called once per review submission.",
    model: "GPT-4o-mini",
    costLabel: "~$0.00024 / review",
    color: "#006FCF",
    tokenShare: 24,
  },
  {
    label: "Photo Analysis",
    description:
      "Each uploaded photo is sent to GPT-4o-mini Vision, which identifies the topic it depicts, a sentiment label, and a short caption. Called immediately on photo selection.",
    model: "GPT-4o-mini Vision",
    costLabel: "~$0.00014 / photo",
    color: "#FFC72C",
    tokenShare: 15,
  },
];

const ZERO_COST_FEATURES: Feature[] = [
  {
    label: "Offline Topic Classification",
    description:
      "GPT-4o batch-classified all 7,200 historical Expedia reviews once before the demo. Results are stored permanently in topic-classifications.json. Never called again.",
    model: "GPT-4o — one-time script",
    costLabel: "~$4.05 total (one-time)",
    color: "#94a3b8",
  },
  {
    label: "Live Topic Classification",
    description:
      "MiniLM (~90 MB, local) embeds new guest reviews into 384-dimensional vectors and computes cosine similarity against pre-cached topic embeddings. No API call, no per-request cost.",
    model: "MiniLM — local ONNX",
    costLabel: "$0.00",
    color: "#22c55e",
  },
  {
    label: "Sentiment ABSA",
    description:
      "MiniLM filters relevant sentences per topic, then DistilBERT (~67 MB, local) classifies each sentence as positive or negative. Scores are similarity-weighted and averaged. Results cached to disk.",
    model: "MiniLM + DistilBERT — local ONNX",
    costLabel: "$0.00",
    color: "#22c55e",
  },
  {
    label: "Continuous Learning",
    description:
      "Pearson correlation, closed-form OLS regression, and running-mean stabilisation learn per-property weights from historical rating data. Pure statistics — no model inference.",
    model: "Statistical — in-process",
    costLabel: "$0.00",
    color: "#22c55e",
  },
];

// ── SVG pie chart helpers ─────────────────────────────────────────────────────

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToXY(cx, cy, r, startDeg);
  const end = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AIUsagePieChart() {
  const cx = 100;
  const cy = 100;
  const r = 80;
  const innerR = 44; // donut hole

  // Build slices from tokenShare values
  let cursor = 0;
  const slices = RUNTIME_FEATURES.map((f) => {
    const deg = ((f.tokenShare ?? 0) / 100) * 360;
    const start = cursor;
    const end = cursor + deg;
    cursor = end;
    return { ...f, start, end };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-[#1E243A]">AI & ML Usage Breakdown</h3>
        <p className="text-sm text-gray-500 mt-1">
          Token proportions are estimated across a typical session (10 reviews, 8 photos, 5 insight
          panels). Prices use OpenAI's published April 2025 rates.
        </p>
      </div>

      {/* Pie chart + legend */}
      <div className="flex flex-col sm:flex-row items-center gap-8">
        {/* SVG donut */}
        <div className="relative flex-shrink-0">
          <svg width="200" height="200" viewBox="0 0 200 200">
            {slices.map((s) => (
              <path
                key={s.label}
                d={slicePath(cx, cy, r, s.start, s.end)}
                fill={s.color}
                stroke="white"
                strokeWidth="2"
              />
            ))}
            {/* Donut hole */}
            <circle cx={cx} cy={cy} r={innerR} fill="white" />
            {/* Centre label */}
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
              Runtime
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
              GPT tokens
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-3 w-full">
          {slices.map((s) => (
            <div key={s.label} className="flex items-start gap-3">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0 mt-0.5"
                style={{ background: s.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[#1E243A]">{s.label}</span>
                  <span className="text-xs font-bold" style={{ color: s.color }}>
                    {s.tokenShare}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{s.model}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full cost table — all features */}
      <div>
        <h4 className="text-sm font-bold text-[#1E243A] mb-3">Cost per feature</h4>
        <div className="rounded-2xl border border-[#E4E7EF] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F7FA] border-b border-[#E4E7EF]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Feature
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                  Model
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Estimated cost
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EF]">
              {/* Runtime GPT features */}
              {RUNTIME_FEATURES.map((f) => (
                <tr key={f.label} className="bg-white hover:bg-[#F5F7FA] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ background: f.color }}
                      />
                      <div>
                        <p className="font-medium text-[#1E243A]">{f.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-snug sm:hidden">{f.model}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{f.model}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#1E243A]">
                    {f.costLabel}
                  </td>
                </tr>
              ))}

              {/* Divider row */}
              <tr className="bg-[#F5F7FA]">
                <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  One-time &amp; local (no ongoing API cost)
                </td>
              </tr>

              {/* Zero-cost / one-time features */}
              {ZERO_COST_FEATURES.map((f) => (
                <tr key={f.label} className="bg-white hover:bg-[#F5F7FA] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ background: f.color }}
                      />
                      <div>
                        <p className="font-medium text-[#1E243A]">{f.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-snug sm:hidden">{f.model}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{f.model}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#1E243A]">
                    {f.costLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-session cost estimate */}
      <div
        className="rounded-2xl p-5 border"
        style={{ background: "linear-gradient(135deg, #f0f7ff, #e8f4ff)", borderColor: "#c7dff7" }}
      >
        <p className="text-sm font-bold text-[#003580] mb-2">Estimated cost for a typical demo session</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "10 reviews submitted", cost: "~$0.0024" },
            { label: "8 photos uploaded", cost: "~$0.0011" },
            { label: "5 insight panels opened", cost: "~$0.0042" },
            { label: "Session total", cost: "~$0.008", highlight: true },
          ].map(({ label, cost, highlight }) => (
            <div key={label} className={`rounded-xl p-3 text-center ${highlight ? "bg-[#003580]" : "bg-white"}`}>
              <p className={`text-lg font-extrabold ${highlight ? "text-white" : "text-[#003580]"}`}>{cost}</p>
              <p className={`text-xs mt-0.5 ${highlight ? "text-white/70" : "text-gray-500"}`}>{label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#003580]/60 mt-3">
          The offline GPT-4o classification script (~$4.05) is a one-time cost already incurred. All ML inference (MiniLM, DistilBERT, regression) runs free in-process.
        </p>
      </div>
    </div>
  );
}
