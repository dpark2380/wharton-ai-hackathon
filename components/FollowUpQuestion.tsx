"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, MessageCircle, Mic } from "lucide-react";

const VoiceInput = dynamic(() => import("./VoiceInput"), {
  ssr: false,
  loading: () => (
    <button disabled className="p-3 rounded-full bg-gray-100 text-gray-300 cursor-not-allowed">
      <Mic className="w-4 h-4" />
    </button>
  ),
});

export interface FollowUpQuestion {
  question: string;
  type: "text" | "yes_no" | "multiple_choice";
  options?: string[];
  topic: string;
  topicId: string;
  priority: "high" | "medium";
}

interface FollowUpQuestionCardProps {
  question: FollowUpQuestion;
  index: number;
  onAnswer: (topicId: string, answer: string) => void;
}

export default function FollowUpQuestionCard({
  question,
  index,
  onAnswer,
}: FollowUpQuestionCardProps) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleSubmit = (ans: string) => {
    if (!ans.trim()) return;
    setSubmitted(true);
    onAnswer(question.topicId, ans);
  };

  const priorityColor = question.priority === "high" ? "#ef4444" : "#f59e0b";
  const priorityBg = question.priority === "high" ? "#fef2f2" : "#fffbeb";
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
            <p className="text-sm text-green-700 mt-1">"{answer || selectedOption}"</p>
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
      <div className="flex items-start gap-2 mb-3">
        <MessageCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: priorityColor }} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: priorityColor }}
            >
              {question.topic}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: priorityColor + "20", color: priorityColor }}
            >
              {question.priority} priority
            </span>
          </div>
          <p className="text-sm font-semibold text-[#1a1a2e] leading-snug">
            {question.question}
          </p>
        </div>
      </div>

      {/* Input based on type */}
      {question.type === "yes_no" && (
        <div className="flex gap-3 mt-3">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              onClick={() => { setSelectedOption(opt); handleSubmit(opt); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 hover:opacity-90 active:scale-95"
              style={{
                background: opt === "Yes" ? "#22c55e" : "#ef4444",
                color: "white",
                borderColor: "transparent",
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {question.type === "multiple_choice" && question.options && (
        <div className="flex flex-col gap-2 mt-3">
          {question.options.map((opt) => (
            <button
              key={opt}
              onClick={() => { setSelectedOption(opt); handleSubmit(opt); }}
              className="py-2.5 px-4 rounded-xl text-sm font-medium border text-left transition-all duration-200 hover:border-[#ff6b35] hover:bg-white active:scale-[0.98]"
              style={{ borderColor: "#e5e0d8", background: "white" }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {question.type === "text" && (
        <div className="mt-3">
          <div className="flex gap-2 items-end">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer..."
              rows={2}
              className="flex-1 text-sm rounded-xl border border-[#e5e0d8] bg-white px-3 py-2 resize-none focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-[#ff6b3533]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(answer);
                }
              }}
            />
            <VoiceInput
              onTranscript={(t) => setAnswer((prev) => (prev ? prev + " " + t : t))}
            />
          </div>
          {answer.trim() && (
            <button
              onClick={() => handleSubmit(answer)}
              className="mt-2 w-full py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #ff6b35, #f59e0b)" }}
            >
              Submit Answer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
