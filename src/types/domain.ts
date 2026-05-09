export type ScoreBand = "low" | "medium" | "great";

export type Correlation = "positive" | "uncertain" | "negative";

export interface MarketIndex {
  symbol: string;
  name: string;
  value: string;
  change: number;
  updatedAt: string;
}

export interface ArticleContext {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  countryCode: string;
  category: string;
  summary: string;
  marketReason: string;
  weight: number;
  weightReason?: string;
}

export interface MarketCategory {
  id: string;
  countryCode: string;
  label: string;
  score: number;
  summary: string;
  impactSummary: string;
  articles: ArticleContext[];
}

export interface CountryContext {
  code: string;
  name: string;
  continent: string;
  centroid: [number, number];
  categories: MarketCategory[];
}

export interface InteractionArrow {
  id: string;
  from: string;
  to: string;
  correlation: Correlation;
  intensity: number;
  label: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  contextIds?: string[];
}

export interface ChatThread {
  id: string;
  title: string;
  summary?: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatContextItem {
  id: string;
  label: string;
  sourceLabel: string;
  content: string;
}

export interface Skill {
  name: string;
  description: string;
  body: string;
}

export interface CommandCenterSnapshot {
  indexes: MarketIndex[];
  countries: CountryContext[];
  interactions: InteractionArrow[];
  chat: ChatMessage[];
  lastRefresh: string;
}

export interface AppSettings {
  openRouterApiKey: string;
  openRouterModel: string;
  financeApiKey: string;
  refreshMinutes: number;
}
