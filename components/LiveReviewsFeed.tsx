"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, ChevronDown, ChevronUp, ArrowRight, TrendingUp } from "lucide-react";
import { getTopicById } from "@/lib/topics";

interface LiveAnswer {
  topicId: string;
  topicLabel: string;
  answer: string;
}

export interface LiveReviewPhoto {
  dataUrl: string;
  topicId: string;
  label: string;
  sentiment: string;
}

export interface LiveReviewEvent {
  id: string;
  propertyId: string;
  propertyName: string;
  submittedAt: string; // ISO string, serialisable from server
  travelerName: string;
  overallRating: number;
  reviewText: string;
  previousScore: number;
  newScore: number;
  improvement: number;
  improvedTopics: string[];
  answers: LiveAnswer[];
  photos: LiveReviewPhoto[];
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "fill-gray-100 text-gray-100"}`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ event }: { event: LiveReviewEvent }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(event.submittedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all">
      {/* Always-visible header, click to expand */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1E243A] truncate">{event.propertyName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{event.travelerName} · {time}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {event.improvement > 0 ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                {event.previousScore} → {event.newScore}
              </span>
            ) : (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-200">
                score {event.newScore}
              </span>
            )}
            {expanded
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />
            }
          </div>
        </div>

        <StarRow rating={event.overallRating} />

        {!expanded && event.reviewText && (
          <p className="text-xs text-gray-500 italic mt-2 line-clamp-1">
            &ldquo;{event.reviewText}&rdquo;
          </p>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">
          {/* Review text */}
          {event.reviewText ? (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Written Review</p>
              <p className="text-sm text-gray-700 leading-relaxed italic">
                &ldquo;{event.reviewText}&rdquo;
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No written review provided.</p>
          )}

          {/* Follow-up answers */}
          {event.answers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Follow-up Answers</p>
              <div className="space-y-2">
                {event.answers.map((a) => (
                  <div key={a.topicId} className="bg-gray-50 rounded-xl px-3 py-2">
                    <p className="text-xs font-semibold text-[#1E243A] mb-0.5">{a.topicLabel}</p>
                    <p className="text-sm text-gray-600">{a.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photos */}
          {event.photos?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Photos</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {event.photos.map((photo, i) => (
                  <div key={i} className="flex-shrink-0 w-28 rounded-xl overflow-hidden border border-gray-100">
                    <img src={photo.dataUrl} alt={photo.label} className="w-28 h-20 object-cover" />
                    <div className="p-1.5 bg-white">
                      <p className="text-[10px] font-medium text-[#1a1a2e] leading-snug line-clamp-2">{photo.label}</p>
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: photo.sentiment === "positive" ? "#22c55e" : photo.sentiment === "negative" ? "#ef4444" : "#6b7280" }}
                      >
                        {photo.sentiment}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score change */}
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${event.improvement > 0 ? "bg-green-50" : "bg-gray-50"}`}>
            <TrendingUp className={`w-4 h-4 flex-shrink-0 ${event.improvement > 0 ? "text-green-600" : "text-gray-400"}`} />
            <p className={`text-sm font-medium ${event.improvement > 0 ? "text-green-700" : "text-gray-500"}`}>
              {event.improvement > 0
                ? `Health score improved: ${event.previousScore} → ${event.newScore}`
                : `Health score unchanged at ${event.newScore}`}
            </p>
          </div>

          {/* Topics covered */}
          {event.improvedTopics.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Topics Covered</p>
              <div className="flex flex-wrap gap-1.5">
                {event.improvedTopics.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium border border-blue-100">
                    {getTopicById(t)?.label ?? t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Link to hotel */}
          <Link
            href={`/property/${event.propertyId}`}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold text-[#1E243A] border border-gray-200 hover:border-[#1E243A] hover:bg-gray-50 transition-all"
          >
            View Hotel Analytics
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

export default function LiveReviewsFeed({ events }: { events: LiveReviewEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <h2 className="text-lg font-bold text-[#1E243A]">Live Reviews Today</h2>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
          {events.length} submitted
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {events.map((event) => (
          <ReviewCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
