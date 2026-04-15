"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, X, TrendingUp, Star } from "lucide-react";

interface ReviewEvent {
  id: string;
  propertyId: string;
  propertyName: string;
  submittedAt: string;
  previousScore: number;
  newScore: number;
  improvement: number;
  improvedTopics: string[];
  reviewText: string;
  overallRating: number;
  travelerName: string;
}

interface ToastNotification extends ReviewEvent {
  toastId: string;
}

export default function ManagerNotifications() {
  const [unread, setUnread] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // SSE connection
  useEffect(() => {
    const source = new EventSource("/api/events");

    source.onmessage = (e) => {
      const event: ReviewEvent = JSON.parse(e.data);

      setEvents((prev) => [event, ...prev].slice(0, 50));
      setUnread((n) => n + 1);

      // Show toast
      const toastId = `${event.id}-${Date.now()}`;
      setToasts((prev) => [{ ...event, toastId }, ...prev]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
      }, 6000);
    };

    source.onerror = () => {
      // SSE will auto-reconnect, no action needed
    };

    return () => source.close();
  }, []);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    if (panelOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelOpen]);

  const handleBellClick = () => {
    setPanelOpen((o) => !o);
    if (!panelOpen) setUnread(0);
  };

  return (
    <>
      {/* Bell button */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={handleBellClick}
          className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/10"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4 text-gray-300" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        {/* Dropdown panel */}
        {panelOpen && (
          <div
            className="absolute right-0 top-10 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-bold text-[#1E243A]">Live Review Feed</p>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {events.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No reviews yet.</p>
                  <p className="text-xs text-gray-300 mt-1">New submissions will appear here in real time.</p>
                </div>
              ) : (
                events.map((ev) => (
                  <EventRow key={ev.id} event={ev} />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast stack */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <Toast
            key={toast.toastId}
            toast={toast}
            onDismiss={() =>
              setToasts((prev) => prev.filter((t) => t.toastId !== toast.toastId))
            }
          />
        ))}
      </div>
    </>
  );
}

function EventRow({ event }: { event: ReviewEvent }) {
  const delta = event.newScore - event.previousScore;
  const time = new Date(event.submittedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-semibold text-[#1E243A] leading-snug flex-1">{event.propertyName}</p>
        <span className="text-[10px] text-gray-400 flex-shrink-0">{time}</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <StarRow rating={event.overallRating} />
        <span className="text-xs text-gray-400">by {event.travelerName}</span>
      </div>
      {event.reviewText && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-1.5 italic">
          &ldquo;{event.reviewText}&rdquo;
        </p>
      )}
      {delta > 0 && (
        <div className="flex items-center gap-1 text-xs font-semibold text-green-600">
          <TrendingUp className="w-3 h-3" />
          Health score +{delta} pts ({event.previousScore} → {event.newScore})
        </div>
      )}
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`}
        />
      ))}
    </div>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastNotification;
  onDismiss: () => void;
}) {
  const delta = toast.newScore - toast.previousScore;

  return (
    <div
      className="pointer-events-auto w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 animate-slide-in"
      style={{ animation: "slideIn 0.3s ease-out" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-[#1E243A] leading-snug">{toast.propertyName}</p>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <StarRow rating={toast.overallRating} />
        <span className="text-xs text-gray-400">by {toast.travelerName}</span>
      </div>

      {toast.reviewText && (
        <p className="text-xs text-gray-500 italic line-clamp-2 mb-2">
          &ldquo;{toast.reviewText}&rdquo;
        </p>
      )}

      {delta > 0 && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 rounded-lg px-2.5 py-1.5">
          <TrendingUp className="w-3 h-3" />
          Health score +{delta} pts · Now {toast.newScore}/100
        </div>
      )}
    </div>
  );
}
