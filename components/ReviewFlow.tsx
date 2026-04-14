"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Star, ArrowRight, Loader2, Mic, AlertCircle } from "lucide-react";
import FollowUpQuestionCard, { FollowUpQuestion } from "./FollowUpQuestion";
import BeforeAfterScore from "./BeforeAfterScore";
import KnowledgeHealthScore from "./KnowledgeHealthScore";
import { checkTextQuality } from "@/lib/quality";

// SSR: false prevents hydration mismatch from SpeechRecognition feature detection
const VoiceInput = dynamic(() => import("./VoiceInput"), {
  ssr: false,
  loading: () => (
    <button disabled className="p-3 rounded-full bg-gray-100 text-gray-300 cursor-not-allowed">
      <Mic className="w-4 h-4" />
    </button>
  ),
});

interface ReviewFlowProps {
  propertyId: string;
  propertyName: string;
  city: string;
  country: string;
  currentHealthScore: number;
  onDirtyChange?: (dirty: boolean) => void;
}

type Step = "write" | "questions" | "thankyou";

interface AnswerPayload {
  topicId: string;
  topicLabel: string;
  answer: string;
  type: FollowUpQuestion["type"];
}

export default function ReviewFlow({
  propertyId,
  propertyName,
  city,
  country,
  currentHealthScore,
  onDirtyChange,
}: ReviewFlowProps) {
  const [step, setStep] = useState<Step>("write");
  const [overallRating, setOverallRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [qualityError, setQualityError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerPayload[]>([]);
  const [scoreResult, setScoreResult] = useState<{
    previousScore: number;
    newScore: number;
    improvement: number;
    improvedTopics: string[];
  } | null>(null);

  const stepNumbers: Record<Step, number> = { write: 1, questions: 2, thankyou: 3 };
  const currentStep = stepNumbers[step];

  // Notify parent whether a review is in progress
  const isDirty = step === "questions" || (step === "write" && (overallRating > 0 || reviewText.trim().length > 0));
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty]);

  const answeredTopicIds = answers.map((a) => a.topicId);

  const handleSubmitReview = async () => {
    if (overallRating === 0) return;

    // ── Client-side quality check (only when text is provided) ───────────────
    if (reviewText.trim()) {
      const quality = checkTextQuality(reviewText);
      if (!quality.isValid) {
        setQualityError(quality.feedback);
        return;
      }
    }
    setQualityError(null);
    // ─────────────────────────────────────────────────────────────────────────

    setIsAnalyzing(true);
    try {
      // Skip analyze step when no text — no topics covered yet
      const coveredIds: string[] = [];
      if (reviewText.trim()) {
        const analyzeRes = await fetch("/api/analyze-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewText }),
        });
        const { coveredTopics } = await analyzeRes.json();
        coveredIds.push(...(coveredTopics ?? []).map((t: { id: string }) => t.id));
      }

      const genRes = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, coveredTopics: coveredIds, reviewText }),
      });

      if (!genRes.ok) {
        // Server-side quality rejection
        const err = await genRes.json();
        if (err.error === "low_quality") {
          setQualityError(err.feedback || "Please write a more detailed review.");
          setIsAnalyzing(false);
          return;
        }
        throw new Error(err.error);
      }

      const { questions: generatedQs } = await genRes.json();
      setQuestions(generatedQs || []);
      setStep("questions");
    } catch (err) {
      console.error(err);
      setQualityError("Something went wrong. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnswer = (
    topicId: string,
    answer: string,
    type: FollowUpQuestion["type"]
  ) => {
    if (answeredTopicIds.includes(topicId)) return;
    const q = questions.find((q) => q.topicId === topicId);
    setAnswers((prev) => [
      ...prev,
      { topicId, topicLabel: q?.topic ?? topicId, answer, type },
    ]);
  };

  const handleFinish = async () => {
    try {
      const res = await fetch("/api/process-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          answers: answers.map(({ topicId, answer, type }) => ({
            topicId,
            answer,
            type,
          })),
        }),
      });
      const data = await res.json();
      setScoreResult({
        previousScore: data.previousScore,
        newScore: data.newScore,
        improvement: data.improvement,
        improvedTopics: answers
          .filter((a) => data.improvedTopics.includes(a.topicId))
          .map((a) => a.topicLabel),
      });
    } catch {
      // Graceful fallback - still show the result
      setScoreResult({
        previousScore: currentHealthScore,
        newScore: Math.min(100, currentHealthScore + answers.length * 4),
        improvement: answers.length * 4,
        improvedTopics: answers.map((a) => a.topicLabel),
      });
    }
    setStep("thankyou");
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#e5e0d8] overflow-hidden">
      {/* Step indicator */}
      <div className="bg-[#1a1a2e] px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <KnowledgeHealthScore score={currentHealthScore} size="sm" />
          <div>
            <p className="text-white font-semibold text-sm">{propertyName}</p>
            <p className="text-gray-400 text-xs">{city}, {country}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {["Share Your Experience", "Smart Follow-ups", "Impact"].map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    i + 1 <= currentStep
                      ? "bg-[#ff6b35] text-white"
                      : "bg-white/10 text-gray-400"
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`text-xs whitespace-nowrap ${i + 1 === currentStep ? "text-[#ff6b35]" : "text-gray-500"}`}>
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div
                  className={`h-px flex-1 transition-all duration-500 ${
                    i + 1 < currentStep ? "bg-[#ff6b35]" : "bg-white/10"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="p-6">
        {step === "write" && (
          <WriteStep
            overallRating={overallRating}
            hoverRating={hoverRating}
            reviewText={reviewText}
            isAnalyzing={isAnalyzing}
            qualityError={qualityError}
            onRatingChange={setOverallRating}
            onHoverChange={setHoverRating}
            onTextChange={(t) => { setReviewText(t); setQualityError(null); }}
            onVoiceTranscript={(t) => {
              setReviewText((prev) => (prev ? prev + " " + t : t));
              setQualityError(null);
            }}
            onSubmit={handleSubmitReview}
          />
        )}

        {step === "questions" && (
          <QuestionsStep
            questions={questions}
            answeredTopicIds={answeredTopicIds}
            onAnswer={handleAnswer}
            onFinish={handleFinish}
          />
        )}

        {step === "thankyou" && scoreResult && (
          <div className="flex flex-col items-center">
            <BeforeAfterScore
              previousScore={scoreResult.previousScore}
              newScore={scoreResult.newScore}
              improvement={scoreResult.improvement}
              improvedTopics={scoreResult.improvedTopics}
            />
            
            {/* Added Return Button */}
            <button
              onClick={() => window.location.href = '/'}
              className="mt-8 px-8 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #ff6b35, #f59e0b)" }}
            >
              Return to Main Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Write Step ────────────────────────────────────────────────────────────────
function WriteStep({
  overallRating,
  hoverRating,
  reviewText,
  isAnalyzing,
  qualityError,
  onRatingChange,
  onHoverChange,
  onTextChange,
  onVoiceTranscript,
  onSubmit,
}: {
  overallRating: number;
  hoverRating: number;
  reviewText: string;
  isAnalyzing: boolean;
  qualityError: string | null;
  onRatingChange: (n: number) => void;
  onHoverChange: (n: number) => void;
  onTextChange: (s: string) => void;
  onVoiceTranscript: (s: string) => void;
  onSubmit: () => void;
}) {
  const canSubmit = overallRating > 0 && !isAnalyzing;
  const quality = reviewText.trim().length > 0 ? checkTextQuality(reviewText) : null;

  // Visual quality indicator
  const qualityBarWidth = quality ? Math.round(quality.score * 100) : 0;
  const qualityBarColor =
    quality && quality.score >= 0.7 ? "#22c55e"
    : quality && quality.score >= 0.4 ? "#f59e0b"
    : "#ef4444";

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-[#1a1a2e] mb-1">Share Your Experience</h2>
        <p className="text-sm text-gray-500">
          Tell us about your stay. We'll ask the right follow-up questions.
        </p>
      </div>

      {/* Star rating */}
      <div>
        <p className="text-sm font-semibold text-[#1a1a2e] mb-2">Overall Rating</p>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => onHoverChange(star)}
              onMouseLeave={() => onHoverChange(0)}
              onClick={() => onRatingChange(star)}
              className="transition-transform duration-100 hover:scale-110 active:scale-95"
            >
              <Star
                className={`w-8 h-8 transition-colors ${
                  star <= (hoverRating || overallRating)
                    ? "fill-amber-400 text-amber-400"
                    : "fill-gray-200 text-gray-200"
                }`}
              />
            </button>
          ))}
          {overallRating > 0 && (
            <span className="text-sm font-medium text-gray-600 ml-1">
              {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][overallRating]}
            </span>
          )}
        </div>
      </div>

      {/* Text + voice */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-[#1a1a2e]">Your Review <span className="text-gray-400 font-normal">(optional)</span></p>
          <VoiceInput onTranscript={onVoiceTranscript} />
        </div>
        <textarea
          value={reviewText}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Tell us about the room, service, location... anything that stood out."
          rows={5}
          className={`w-full text-sm rounded-xl border bg-[#faf8f5] px-4 py-3 resize-none focus:outline-none focus:ring-2 transition-all ${
            qualityError
              ? "border-red-400 focus:border-red-400 focus:ring-red-100"
              : "border-[#e5e0d8] focus:border-[#ff6b35] focus:ring-[#ff6b3520]"
          }`}
        />

        {/* Quality bar - live as they type */}
        {reviewText.trim().length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Review quality</span>
              <span className="text-xs font-medium" style={{ color: qualityBarColor }}>
                {quality?.isValid ? (qualityBarWidth >= 70 ? "Great" : "OK") : "Needs work"}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${qualityBarWidth}%`, background: qualityBarColor }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {qualityError && (
          <div className="mt-2 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{qualityError}</p>
          </div>
        )}
      </div>

      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "linear-gradient(135deg, #ff6b35, #f59e0b)" }}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing your review...
          </>
        ) : (
          <>
            Continue
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
}

// ─── Questions Step ─────────────────────────────────────────────────────────
function QuestionsStep({
  questions,
  answeredTopicIds,
  onAnswer,
  onFinish,
}: {
  questions: FollowUpQuestion[];
  answeredTopicIds: string[];
  onAnswer: (topicId: string, answer: string, type: FollowUpQuestion["type"]) => void;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-[#1a1a2e] mb-1">A couple quick questions</h2>
        <p className="text-sm text-gray-500">
          Based on your review, we spotted some info gaps. Mind helping fill them?
        </p>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">
            Great coverage! Your review already covers the key topics.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <FollowUpQuestionCard
              key={q.topicId + i}
              question={q}
              index={i}
              onAnswer={onAnswer}
            />
          ))}
        </div>
      )}

      <button
        onClick={onFinish}
        className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
        style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}
      >
        See My Impact
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
