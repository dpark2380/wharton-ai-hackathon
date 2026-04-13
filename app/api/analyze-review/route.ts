import { NextResponse } from "next/server";
import { classifyText } from "@/lib/topics";
import { TOPICS } from "@/lib/topics";

export async function POST(request: Request) {
  try {
    const { reviewText } = await request.json();

    if (!reviewText || typeof reviewText !== "string") {
      return NextResponse.json({ coveredTopics: [] });
    }

    const covered = classifyText(reviewText);
    const coveredTopics = TOPICS
      .filter((t) => covered.has(t.id))
      .map((t) => ({ id: t.id, label: t.label }));

    return NextResponse.json({ coveredTopics });
  } catch (err) {
    console.error("Error in /api/analyze-review:", err);
    return NextResponse.json({ error: "Failed to analyze review" }, { status: 500 });
  }
}
