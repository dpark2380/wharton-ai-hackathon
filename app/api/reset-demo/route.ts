import { NextResponse } from "next/server";
import { reviewStore } from "@/lib/store";
import { invalidateAnalysisCache } from "@/lib/analysis";
import { loadProperties } from "@/lib/data";

export async function POST() {
  // Invalidate cached analysis for all properties so scores recompute from CSV baseline
  const properties = loadProperties();
  for (const p of properties) {
    invalidateAnalysisCache(p.eg_property_id);
  }

  reviewStore.reset();

  console.log("[demo] Store reset, all live reviews cleared.");
  return NextResponse.json({ ok: true, message: "Demo reset. All live reviews cleared." });
}
