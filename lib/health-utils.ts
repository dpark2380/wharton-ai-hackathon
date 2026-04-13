// Pure client-safe utilities — no `fs` or server-only imports

export function getKnowledgeHealthColor(score: number): string {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export function getKnowledgeHealthLabel(score: number): string {
  if (score >= 75) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Attention";
}
