"use client";

import { useState } from "react";
import { Star, ArrowRight, Loader2 } from "lucide-react";
import VoiceInput from "./VoiceInput";
import FollowUpQuestionCard, { FollowUpQuestion } from "./FollowUpQuestion";
import BeforeAfterScore from "./BeforeAfterScore";
import KnowledgeHealthScore from "./KnowledgeHealthScore";

interface ReviewFlowProps {
  propertyId: string;
  propertyName: string;
  city: string;
  country: string;
  currentHealthScore: number;
}

type Step = "write" | "questions" | "thankyou";

export default function ReviewFlow({
  propertyId,
  propertyName,
  city,
  country,
  currentHealthScore,
}: ReviewFlowProps) {
  const [step, setStep] = useState<Step>("write");
  const [overallRating, setOverallRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([]);
  const [answeredTopics, setAnsweredTopics] = useState<string[]>([]);
  const [answeredTopicLabels, setAnsweredTopicLabels] = useState<string[]>([]);
  const [scoreResult, setScoreResult] = useState<{
    previousScore: number;
    newScore: number;
    improvement: number;
  } | null>(null);

  const stepNumbers: Record<Step, number> = { write: 1, questions: 2, thankyou: 3 };
  const currentStep = stepNumbers[step];

  const handleSubmitReview = async () => {
    if (!reviewText.trim() || overallRating === 0) return;
    setIsAnalyzing(true);

    try {
      // Analyze what topics the review covers
      const analyzeRes = await fetch("/api/analyze-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewText }),
      });
      const { coveredTopics } = await analyzeRes.json();
      const coveredIds = coveredTopics.map((t: { id: string }) => t.id);

      // Generate follow-up questions
      const genRes = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, coveredTopics: coveredIds, reviewText }),
      });
      const { questions: generatedQs } = await genRes.json();
      setQuestions(generatedQs || []);
      setStep("questions");
    } catch (err) {
      console.error(err);
      setStep("questions");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnswer = (topicId: string, answer: string, topicLabel?: string) => {
    if (!answeredTopics.includes(topicId)) {
      setAnsweredTopics((prev) => [...prev, topicId]);
      if (topicLabel) setAnsweredTopicLabels((prev) => [...prev, topicLabel]);
    }
  };

  const handleFinish = async () => {
    try {
      const res = await fetch("/api/process-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, answeredTopics }),
      });
      const data = await res.json();
      setScoreResult(data);
    } catch {
      setScoreResult({
        previousScore: currentHealthScore,
        newScore: Math.min(100, currentHealthScore + answeredTopics.length * 5),
        improvement: answeredTopics.length * 5,
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
            onRatingChange={setOverallRating}
            onHoverChange={setHoverRating}
            onTextChange={setReviewText}
            onVoiceTranscript={(t) => setReviewText((prev) => prev ? prev + " " + t : t)}
            onSubmit={handleSubmitReview}
          />
        )}

        {step === "questions" && (
          <QuestionsStep
            questions={questions}
            answeredTopics={answeredTopics}
            onAnswer={(topicId, answer) => {
              const q = questions.find((q) => q.topicId === topicId);
              handleAnswer(topicId, answer, q?.topic);
            }}
            onFinish={handleFinish}
          />
        )}

        {step === "thankyou" && scoreResult && (
          <BeforeAfterScore
            previousScore={scoreResult.previousScore}
            newScore={scoreResult.newScore}
            improvement={scoreResult.improvement}
            improvedTopics={answeredTopicLabels}
          />
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
  onRatingChange: (n: number) => void;
  onHoverChange: (n: number) => void;
  onTextChange: (s: string) => void;
  onVoiceTranscript: (s: string) => void;
  onSubmit: () => void;
}) {
  const canSubmit = overallRating > 0 && reviewText.trim().length > 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-[#1a1a2e] mb-1">Share Your Experience</h2>
        <p className="text-sm text-gray-500">Tell us about your stay — we'll ask the right follow-up questions.</p>
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
          <p className="text-sm font-semibold text-[#1a1a2e]">Your Review</p>
          <VoiceInput onTranscript={onVoiceTranscript} />
        </div>
        <textarea
          value={reviewText}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Tell us about the room, service, location... anything that stood out."
          rows={5}
          className="w-full text-sm rounded-xl border border-[#e5e0d8] bg-[#faf8f5] px-4 py-3 resize-none focus:outline-none focus:border-[#ff6b35] focus:ring-2 focus:ring-[#ff6b3520] transition-all"
        />
        <p className="text-xs text-gray-400 mt-1">{reviewText.length} characters</p>
      </div>

      <button
        onClick={onSubmit}
        disabled={!canSubmit || isAnalyzing}
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
  answeredTopics,
  onAnswer,
  onFinish,
}: {
  questions: FollowUpQuestion[];
  answeredTopics: string[];
  onAnswer: (topicId: string, answer: string) => void;
  onFinish: () => void;
}) {
  const allAnswered = questions.length > 0 && questions.every((q) => answeredTopics.includes(q.topicId));

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
          <p className="text-gray-500 text-sm">Great coverage! Your review already covers the key topics.</p>
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
