/**
 * lib/store.ts
 *
 * In-memory store for live reviews submitted during the demo.
 * Resets automatically when the dev server restarts — no persistence needed.
 *
 * Uses globalThis so the singleton survives Next.js hot-module reloads in dev.
 * Import reviewStore wherever you need to read or write live reviews.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LivePhoto {
  id: string;
  dataUrl: string;            // data:image/...;base64,...
  topicId: string;
  topicLabel: string;
  sentiment: "positive" | "negative" | "neutral";
  label: string;              // short AI-generated label
}

export interface LiveReview {
  id: string;
  propertyId: string;
  submittedAt: Date;
  overallRating: number;      // 1–5
  reviewText: string;
  coveredTopicIds: string[];  // topics identified in the written review
  answers: LiveAnswer[];
  photos: LivePhoto[];
  travelerName: string;       // simulated user
}

export interface LiveAnswer {
  topicId: string;
  topicLabel: string;
  answer: string;
  type: "text" | "yes_no" | "multiple_choice";
}

export interface ReviewEvent {
  id: string;
  propertyId: string;
  propertyName: string;
  submittedAt: Date;
  previousScore: number;
  newScore: number;
  improvement: number;
  improvedTopics: string[];
  reviewText: string;
  overallRating: number;
  travelerName: string;
  photos: { dataUrl: string; topicId: string; label: string; sentiment: string }[];
}

// Mirrors lib/data.ts Review shape — duplicated here to avoid a circular import
// (data.ts will import from store.ts, so store.ts must not import from data.ts)
interface ReviewShape {
  eg_property_id: string;
  acquisition_date: string;
  lob: string;
  rating: {
    overall: number;
    roomcleanliness: number;
    service: number;
    roomcomfort: number;
    hotelcondition: number;
    roomquality: number;
    convenienceoflocation: number;
    neighborhoodsatisfaction: number;
    valueformoney: number;
    roomamenitiesscore: number;
    communication: number;
    ecofriendliness: number;
    checkin: number;
    onlinelisting: number;
    location: number;
  };
  review_title: string;
  review_text: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateMDYY(d: Date): string {
  // Matches the M/D/YY format used in Reviews_PROC.csv
  const yy = String(d.getFullYear()).slice(2);
  return `${d.getMonth() + 1}/${d.getDate()}/${yy}`;
}

// ── Store class ───────────────────────────────────────────────────────────────

class ReviewStore {
  private reviews = new Map<string, LiveReview[]>();
  private events: ReviewEvent[] = [];
  private listeners = new Set<(event: ReviewEvent) => void>();

  // ── Write ───────────────────────────────────────────────────────────────────

  addReview(review: LiveReview): void {
    const existing = this.reviews.get(review.propertyId) ?? [];
    this.reviews.set(review.propertyId, [...existing, review]);
  }

  pushEvent(event: ReviewEvent): void {
    this.events.unshift(event);             // newest first
    if (this.events.length > 100) this.events.pop();
    this.listeners.forEach((fn) => fn(event));
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  getLiveReviewsForProperty(propertyId: string): LiveReview[] {
    return this.reviews.get(propertyId) ?? [];
  }

  getRecentEvents(limit = 20): ReviewEvent[] {
    return this.events.slice(0, limit);
  }

  getTotalLiveReviews(): number {
    let n = 0;
    for (const arr of this.reviews.values()) n += arr.length;
    return n;
  }

  // ── Convert to scoring-compatible shape ────────────────────────────────────

  toReviewShape(live: LiveReview): ReviewShape {
    // Sub-ratings are 0 because we don't collect them in the review flow.
    // Append follow-up answers + photo labels to review_text so analyzeProperty
    // can classify them as topic coverage with sentiment signal.
    const answerText = live.answers
      .map((a) => `${a.topicLabel}: ${a.answer}`)
      .join(". ");
    // Photos: prefix with sentiment word so keyword sentiment scoring picks it up
    const photoText = live.photos
      .map((p) => {
        const prefix = p.sentiment === "positive" ? "excellent" : p.sentiment === "negative" ? "poor" : "";
        return `${prefix} ${p.topicLabel}: ${p.label}`.trim();
      })
      .join(". ");
    const fullText = [live.reviewText, answerText, photoText].filter(Boolean).join(". ");

    return {
      eg_property_id: live.propertyId,
      acquisition_date: formatDateMDYY(live.submittedAt),
      lob: "HOTEL",
      rating: {
        overall: live.overallRating,
        roomcleanliness: 0,
        service: 0,
        roomcomfort: 0,
        hotelcondition: 0,
        roomquality: 0,
        convenienceoflocation: 0,
        neighborhoodsatisfaction: 0,
        valueformoney: 0,
        roomamenitiesscore: 0,
        communication: 0,
        ecofriendliness: 0,
        checkin: 0,
        onlinelisting: 0,
        location: 0,
      },
      review_title: "",
      review_text: fullText,
    };
  }

  // ── SSE subscriptions ───────────────────────────────────────────────────────

  /** Subscribe to new review events. Returns an unsubscribe function. */
  subscribe(fn: (event: ReviewEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ── Reset (called on demo restart via terminal or just kill the server) ─────

  reset(): void {
    this.reviews.clear();
    this.events = [];
    // Keep listeners — SSE connections may still be open
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var _reviewStore: ReviewStore | undefined;
}

export const reviewStore: ReviewStore =
  globalThis._reviewStore ?? (globalThis._reviewStore = new ReviewStore());
