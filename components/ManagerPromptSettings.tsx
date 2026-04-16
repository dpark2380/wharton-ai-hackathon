"use client";

import { useState } from "react";
import { TOPICS } from "@/lib/topics";
import { Plus, Trash2, Save, Clock, CheckCircle, AlertCircle } from "lucide-react";
import type { ManagerPrompt } from "@/lib/manager-prompts";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isActive(prompt: ManagerPrompt): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return prompt.expiresAt >= today;
}

interface Props {
  propertyId: string;
  initialPrompts: ManagerPrompt[];
}

export default function ManagerPromptSettings({ propertyId, initialPrompts }: Props) {
  const [prompts, setPrompts] = useState<ManagerPrompt[]>(initialPrompts);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const canAdd = prompts.length < 2;

  const addPrompt = () => {
    if (!canAdd) return;
    const newPrompt: ManagerPrompt = {
      id: Math.random().toString(36).slice(2),
      topicId: TOPICS[0].id,
      topicLabel: TOPICS[0].label,
      note: "",
      expiresAt: todayPlus(14),
      createdAt: new Date().toISOString(),
    };
    setPrompts((prev) => [...prev, newPrompt]);
    setSaved(false);
  };

  const removePrompt = (id: string) => {
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    setSaved(false);
  };

  const updatePrompt = (id: string, changes: Partial<ManagerPrompt>) => {
    setPrompts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...changes } : p))
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/manager-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, prompts }),
      });
      setSaved(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {prompts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#E4E7EF] bg-white px-6 py-10 text-center">
          <p className="text-sm text-gray-400">No active prompts. Add one below to start directing guest feedback.</p>
        </div>
      )}

      {prompts.map((prompt, i) => {
        const active = isActive(prompt);
        return (
          <div
            key={prompt.id}
            className="bg-white rounded-2xl border border-[#E4E7EF] overflow-hidden"
          >
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#E4E7EF]"
              style={{ background: "#F8F9FB" }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#1E243A] uppercase tracking-wide">
                  Prompt {i + 1}
                </span>
                {active ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-3 h-3" /> Expired
                  </span>
                )}
              </div>
              <button
                onClick={() => removePrompt(prompt.id)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Card body */}
            <div className="px-5 py-4 space-y-4">
              {/* Topic selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Topic
                </label>
                <select
                  value={prompt.topicId ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    updatePrompt(prompt.id, {
                      topicId: val || null,
                      topicLabel: val ? (TOPICS.find((t) => t.id === val)?.label ?? val) : "Other",
                    });
                  }}
                  className="w-full text-sm border border-[#E4E7EF] rounded-xl px-3 py-2 bg-white text-[#1E243A] focus:outline-none focus:ring-2 focus:ring-[#006FCF]/30"
                >
                  {TOPICS.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                  <option value="">Other</option>
                </select>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  {prompt.topicId === null
                    ? <>What to ask about <span className="font-normal normal-case text-gray-400">(required — describe the topic, e.g. &quot;our new rooftop bar&quot;)</span></>
                    : <>Context note <span className="font-normal normal-case text-gray-400">(optional — helps generate a more specific question)</span></>
                  }
                </label>
                <textarea
                  value={prompt.note}
                  onChange={(e) => updatePrompt(prompt.id, { note: e.target.value })}
                  placeholder={prompt.topicId === null
                    ? `e.g. "our new rooftop bar" or "the shuttle service to the airport"`
                    : `e.g. "We just renovated all bathrooms last month"`
                  }
                  rows={2}
                  className="w-full text-sm border border-[#E4E7EF] rounded-xl px-3 py-2 bg-white text-[#1E243A] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#006FCF]/30 resize-none"
                />
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Ask guests until
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={prompt.expiresAt}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => updatePrompt(prompt.id, { expiresAt: e.target.value })}
                    className="text-sm border border-[#E4E7EF] rounded-xl px-3 py-2 bg-white text-[#1E243A] focus:outline-none focus:ring-2 focus:ring-[#006FCF]/30"
                  />
                  <div className="flex gap-1.5">
                    {[
                      { label: "1w", days: 7 },
                      { label: "2w", days: 14 },
                      { label: "1m", days: 30 },
                    ].map(({ label, days }) => (
                      <button
                        key={days}
                        onClick={() => updatePrompt(prompt.id, { expiresAt: todayPlus(days) })}
                        className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#E4E7EF] text-gray-500 hover:border-[#006FCF] hover:text-[#006FCF] transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {canAdd && (
          <button
            onClick={addPrompt}
            className="flex items-center gap-2 text-sm font-semibold text-[#006FCF] border border-[#006FCF]/30 hover:border-[#006FCF] hover:bg-[#006FCF]/5 px-4 py-2.5 rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" />
            Add prompt {prompts.length > 0 ? "(1 remaining)" : ""}
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: "#1E243A" }}
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
        </button>
        {saved && (
          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Changes saved
          </span>
        )}
      </div>
    </div>
  );
}
