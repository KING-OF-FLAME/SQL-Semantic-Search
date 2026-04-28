import type { RetrievedChunk } from "./retrieval";

export interface ConfidenceBreakdown {
  retrieval: number;
  rerank: number;
  sourceAgreement: number;
  freshness: number;
  answerability: number;
}

export interface ConfidenceResult {
  score: number;
  label: "High" | "Medium" | "Low";
  breakdown: ConfidenceBreakdown;
}

export function computeConfidence(
  chunks: RetrievedChunk[],
  answer: string,
): ConfidenceResult {
  const topScore = chunks[0]?.combinedScore ?? 0;
  const retrievalScore = Math.min(topScore * 2, 1.0);

  const rerankScore =
    chunks.length > 1
      ? 1 - Math.abs(chunks[0].combinedScore - chunks[1].combinedScore)
      : 0.5;

  const uniqueDomains = new Set(
    chunks.map((c) => {
      try {
        return new URL(c.sourceUrl).hostname;
      } catch {
        return c.sourceUrl;
      }
    }),
  );
  const sourceAgreementScore = Math.min(uniqueDomains.size / 2, 1.0);

  const now = Date.now();
  const avgAgeDays =
    chunks.reduce((sum, c) => {
      const ageDays = (now - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return sum + ageDays;
    }, 0) / Math.max(chunks.length, 1);
  const freshnessScore = Math.max(0, 1 - avgAgeDays / 365);

  const isVerified =
    !answer.toLowerCase().includes("could not verify") &&
    !answer.toLowerCase().includes("unable to find");
  const answerabilityScore = isVerified ? 1.0 : 0.1;

  const score =
    0.35 * retrievalScore +
    0.3 * rerankScore +
    0.2 * sourceAgreementScore +
    0.1 * freshnessScore +
    0.05 * answerabilityScore;

  const label: "High" | "Medium" | "Low" =
    score >= 0.8 ? "High" : score >= 0.6 ? "Medium" : "Low";

  return {
    score: Math.round(score * 100) / 100,
    label,
    breakdown: {
      retrieval: Math.round(retrievalScore * 100) / 100,
      rerank: Math.round(rerankScore * 100) / 100,
      sourceAgreement: Math.round(sourceAgreementScore * 100) / 100,
      freshness: Math.round(freshnessScore * 100) / 100,
      answerability: Math.round(answerabilityScore * 100) / 100,
    },
  };
}

export function scaleToInt(score: number): number {
  return Math.round(score * 100);
}
