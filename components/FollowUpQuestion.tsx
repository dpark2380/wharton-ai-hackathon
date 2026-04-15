"use client";

import { useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";

export interface FollowUpQuestion {
  question: string;
  type: "text" | "yes_no" | "multiple_choice";
  scaleType?: "agreement" | "quality"; // for "text" type: which 5-point scale to show
  options?: string[];
  topic: string;
  topicId: string;
  priority: "high" | "medium";
}

interface FollowUpQuestionCardProps {
  question: FollowUpQuestion;
  index: number;
  onAnswer: (topicId: string, answer: string, type: FollowUpQuestion["type"]) => void;
}

// ── Likert scale config ────────────────────────────────────────────────────────

const AGREEMENT_SCALE = [
  { label: "Strongly\nDisagree", short: "Strongly Disagree", color: "#ef4444" },
  { label: "Disagree",           short: "Disagree",          color: "#f97316" },
  { label: "Neutral",            short: "Neutral",           color: "#6b7280" },
  { label: "Agree",              short: "Agree",             color: "#22c55e" },
  { label: "Strongly\nAgree",    short: "Strongly Agree",    color: "#16a34a" },
];

const QUALITY_SCALE = [
  { label: "Very\nPoor",    short: "Very Poor",  color: "#ef4444" },
  { label: "Poor",          short: "Poor",       color: "#f97316" },
  { label: "Average",       short: "Average",    color: "#6b7280" },
  { label: "Good",          short: "Good",       color: "#22c55e" },
  { label: "Excellent",     short: "Excellent",  color: "#16a34a" },
];

// ── Likert input ───────────────────────────────────────────────────────────────

function LikertInput({
  onSubmit,
  scale,
}: {
  onSubmit: (answer: string) => void;
  scale: "agreement" | "quality";
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [elaboration, setElaboration] = useState("");

  const LIKERT = scale === "quality" ? QUALITY_SCALE : AGREEMENT_SCALE;
  const chosen = selected !== null ? LIKERT[selected] : null;

  const handleDone = () => {
    if (!chosen) return;
    const combined = elaboration.trim()
      ? `${chosen.short} — ${elaboration.trim()}`
      : chosen.short;
    onSubmit(combined);
  };

  const naSelected = selected === -1;

  return (
    <div className="mt-3 space-y-3">
      {/* 5-button scale */}
      <div className="flex gap-1.5">
        {LIKERT.map((opt, i) => {
          const isSelected = selected === i;
          return (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all duration-150 active:scale-95"
              style={{
                background: isSelected ? opt.color : "white",
                borderColor: isSelected ? opt.color : "#e5e0d8",
                boxShadow: isSelected ? `0 0 0 2px ${opt.color}40` : "none",
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full transition-all"
                style={{ background: isSelected ? "white" : opt.color, opacity: isSelected ? 1 : 0.6 }}
              />
              <span
                className="text-[10px] font-semibold leading-tight text-center whitespace-pre-line"
                style={{ color: isSelected ? "white" : opt.color }}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* N/A button */}
      <button
        onClick={() => { setSelected(-1); onSubmit("N/A — did not use this facility"); }}
        className="w-full py-2 rounded-xl text-xs font-medium border transition-all duration-150 active:scale-95"
        style={{
          background: naSelected ? "#f3f4f6" : "white",
          borderColor: "#e5e0d8",
          color: "#9ca3af",
        }}
      >
        Not applicable — I didn&apos;t use this
      </button>

      {/* Optional elaboration */}
      {chosen && (
        <div className="space-y-2 animate-fade-in">
          <textarea
            value={elaboration}
            onChange={(e) => setElaboration(e.target.value)}
            placeholder="Want to add more detail? (optional)"
            rows={2}
            className="w-full text-sm rounded-xl border border-[#e5e0d8] bg-white px-3 py-2 resize-none focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-[#ff6b3533]"
          />
          <button
            onClick={handleDone}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{ background: `linear-gradient(135deg, ${chosen.color}, ${chosen.color}cc)` }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ── Yes / No input ─────────────────────────────────────────────────────────────

function YesNoInput({ onSubmit }: { onSubmit: (answer: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [elaboration, setElaboration] = useState("");

  const handleDone = () => {
    if (!selected) return;
    const combined = elaboration.trim() ? `${selected} — ${elaboration.trim()}` : selected;
    onSubmit(combined);
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex gap-3">
        {["Yes", "No"].map((opt) => {
          const isSelected = selected === opt;
          const color = opt === "Yes" ? "#22c55e" : "#ef4444";
          return (
            <button
              key={opt}
              onClick={() => setSelected(opt)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 hover:opacity-90 active:scale-95"
              style={{
                background: isSelected ? color : "white",
                color: isSelected ? "white" : color,
                borderColor: color,
                boxShadow: isSelected ? `0 0 0 2px ${color}40` : "none",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="space-y-2 animate-fade-in">
          <textarea
            value={elaboration}
            onChange={(e) => setElaboration(e.target.value)}
            placeholder="Want to add more detail? (optional)"
            rows={2}
            className="w-full text-sm rounded-xl border border-[#e5e0d8] bg-white px-3 py-2 resize-none focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-[#ff6b3533]"
          />
          <button
            onClick={handleDone}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main card ──────────────────────────────────────────────────────────────────

export default function FollowUpQuestionCard({
  question,
  index,
  onAnswer,
}: FollowUpQuestionCardProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState("");

  const handleSubmit = (ans: string) => {
    if (!ans.trim()) return;
    setSubmittedAnswer(ans);
    setSubmitted(true);
    onAnswer(question.topicId, ans, question.type);
  };

  const priorityColor = question.priority === "high" ? "#ef4444" : "#f59e0b";
  const priorityBg    = question.priority === "high" ? "#fef2f2" : "#fffbeb";
  const priorityBorder = question.priority === "high" ? "#fecaca" : "#fde68a";

  if (submitted) {
    return (
      <div
        className="rounded-2xl border p-5 animate-fade-in"
        style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}
      >
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">{question.question}</p>
            <p className="text-sm text-green-700 mt-1">&ldquo;{submittedAnswer}&rdquo;</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-5 animate-fade-in-up stagger-${index + 1}`}
      style={{ background: priorityBg, borderColor: priorityBorder }}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-1">
        <MessageCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: priorityColor }} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: priorityColor }}>
              {question.topic}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: priorityColor + "20", color: priorityColor }}
            >
              {question.priority} priority
            </span>
          </div>
          <p className="text-sm font-semibold text-[#1a1a2e] leading-snug">{question.question}</p>
        </div>
      </div>

      {/* Input */}
      {question.type === "yes_no" ? (
        <YesNoInput onSubmit={handleSubmit} />
      ) : question.type === "multiple_choice" && question.options ? (
        <div className="flex flex-col gap-2 mt-3">
          {question.options.map((opt) => (
            <button
              key={opt}
              onClick={() => handleSubmit(opt)}
              className="py-2.5 px-4 rounded-xl text-sm font-medium border text-left transition-all duration-200 hover:border-[#ff6b35] hover:bg-white active:scale-[0.98]"
              style={{ borderColor: "#e5e0d8", background: "white" }}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <LikertInput onSubmit={handleSubmit} scale={question.scaleType ?? "agreement"} />
      )}
    </div>
  );
}
