import type { ArticleContext } from "../types/domain";

export type WeightBand = "low" | "medium" | "high";

export interface WeightBreakdown {
  band: WeightBand;
  formula: string;
  inputs: string[];
  plainEnglish: string;
  relevancePoints: number;
}

export function getWeightBand(weight: number): WeightBand {
  if (weight <= 0.5) return "low";
  if (weight <= 1.5) return "medium";
  return "high";
}

export function describeArticleWeight(article: ArticleContext): WeightBreakdown {
  const relevancePoints = Math.round(clamp(article.weight, 0, 2) * 50);
  const inputs = parseWeightInputs(article.weightReason);
  const band = getWeightBand(article.weight);

  return {
    band,
    formula: `clamp(relevance points ${relevancePoints} / 50, 0, 2) = ${article.weight.toFixed(2)}`,
    inputs,
    relevancePoints,
    plainEnglish: plainEnglishWeight(article, band, inputs)
  };
}

function parseWeightInputs(reason?: string) {
  if (!reason) return ["Baseline discovery signal"];
  return reason
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function plainEnglishWeight(article: ArticleContext, band: WeightBand, inputs: string[]) {
  const sourceText = article.source ? ` from ${article.source}` : "";
  const inputText = inputs.length ? ` The main drivers are ${inputs.slice(0, 3).join(", ")}.` : "";

  if (band === "high") {
    return `This is a high-weight article because it has strong, direct market relevance${sourceText}.${inputText}`;
  }

  if (band === "medium") {
    return `This article has a moderate weight because it has useful market evidence, but the signal is not extreme${sourceText}.${inputText}`;
  }

  return `This article has a low weight because the detected market signal is limited or diluted${sourceText}.${inputText}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
