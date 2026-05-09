import { sampleSnapshot } from "../data/sampleData";
import type { ArticleContext, CommandCenterSnapshot, CountryContext, MarketCategory, MarketIndex } from "../types/domain";

const COINGECKO_MARKETS_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,binancecoin&order=market_cap_desc&per_page=4&page=1&sparkline=false&price_change_percentage=24h";

const GDELT_DISCOVERY_URL =
  "https://api.gdeltproject.org/api/v2/doc/doc?query=(oil OR gas OR lng OR tariff OR sanctions OR trade OR semiconductor OR chip OR \"central bank\" OR inflation OR shipping OR port OR conflict OR unrest) sourcelang:eng&mode=ArtList&maxrecords=75&format=json&timespan=24H";

const COUNTRY_KEYWORDS: Record<string, string[]> = {
  USA: ["united states", "u.s.", "us ", "america", "american", "washington", "federal reserve", "fed "],
  CHN: ["china", "chinese", "beijing", "shanghai", "yuan"],
  DEU: ["germany", "german", "berlin", "eurozone", "ecb"],
  AUS: ["australia", "australian", "canberra", "sydney"]
};

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  "Australia": "AUS",
  "China": "CHN",
  "Germany": "DEU",
  "United States": "USA",
  "United States of America": "USA",
  "US": "USA",
  "USA": "USA"
};

interface CoinGeckoAsset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h_in_currency?: number;
}

interface GdeltArticle {
  title?: string;
  snippet?: string;
  url?: string;
  domain?: string;
  seendate?: string;
  sourcecountry?: string;
}

export async function fetchLiveSnapshot(current: CommandCenterSnapshot): Promise<CommandCenterSnapshot> {
  const [indexes, articles] = await Promise.all([
    fetchCoinGeckoMarkets().catch((error) => {
      console.warn("CoinGecko refresh failed", error);
      return current.indexes.length ? current.indexes : sampleSnapshot.indexes;
    }),
    fetchGdeltArticles().catch((error) => {
      console.warn("GDELT refresh failed", error);
      return [];
    })
  ]);

  return {
    ...current,
    indexes,
    countries: mergeLiveArticles(current.countries.length ? current.countries : sampleSnapshot.countries, articles),
    lastRefresh: new Date().toISOString()
  };
}

function normalizeSnapshot(snapshot: CommandCenterSnapshot): CommandCenterSnapshot {
  return {
    ...sampleSnapshot,
    ...snapshot,
    indexes: snapshot.indexes?.length ? snapshot.indexes : sampleSnapshot.indexes,
    countries: snapshot.countries?.length ? snapshot.countries : sampleSnapshot.countries,
    interactions: snapshot.interactions?.length ? snapshot.interactions : sampleSnapshot.interactions,
    chat: snapshot.chat?.length ? snapshot.chat : sampleSnapshot.chat,
    lastRefresh: snapshot.lastRefresh || sampleSnapshot.lastRefresh
  };
}

export function ensureUsableSnapshot(snapshot: CommandCenterSnapshot): CommandCenterSnapshot {
  return normalizeSnapshot(snapshot);
}

async function fetchCoinGeckoMarkets(): Promise<MarketIndex[]> {
  const response = await fetch(COINGECKO_MARKETS_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`CoinGecko returned ${response.status}`);
  }

  const payload = (await response.json()) as CoinGeckoAsset[];
  return payload.map((asset) => ({
    symbol: asset.symbol.toUpperCase(),
    name: asset.name,
    value: formatUsd(asset.current_price),
    change: Number((asset.price_change_percentage_24h_in_currency ?? 0).toFixed(2)),
    updatedAt: new Date().toISOString()
  }));
}

async function fetchGdeltArticles(): Promise<ArticleContext[]> {
  const response = await fetch(GDELT_DISCOVERY_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`GDELT returned ${response.status}`);
  }

  const payload = (await response.json()) as { articles?: GdeltArticle[] };
  const seen = new Set<string>();
  return (payload.articles ?? []).flatMap((article, index) => {
    const url = article.url ?? "";
    const title = stripHtml(article.title ?? "Untitled market signal");
    const summary = stripHtml(article.snippet ?? "GDELT matched this article against the live market discovery query.");
    const countryCode = inferCountryCode(article, `${title} ${summary}`);
    if (!countryCode || !url || seen.has(url)) return [];
    seen.add(url);

    const category = inferCategory(`${title} ${summary}`);
    const publishedAt = parseGdeltDate(article.seendate);
    const weight = inferWeight(`${title} ${summary}`);

    return [{
      id: `gdelt-${countryCode.toLowerCase()}-${index}-${hashish(url)}`,
      title,
      source: article.domain ?? "GDELT",
      url,
      publishedAt,
      countryCode,
      category,
      summary,
      marketReason: marketReasonFor(category, countryCode),
      weight
    }];
  });
}

function mergeLiveArticles(countries: CountryContext[], articles: ArticleContext[]): CountryContext[] {
  if (!articles.length) return countries;

  return countries.map((country) => {
    const countryArticles = articles.filter((article) => article.countryCode === country.code);
    if (!countryArticles.length) return country;

    const liveCategories = buildCategories(country.code, countryArticles);
    const existingCategories = country.categories.filter(
      (category) => !liveCategories.some((liveCategory) => liveCategory.label === category.label)
    );

    return {
      ...country,
      categories: [...liveCategories, ...existingCategories].slice(0, 6)
    };
  });
}

function buildCategories(countryCode: string, articles: ArticleContext[]): MarketCategory[] {
  const groups = new Map<string, ArticleContext[]>();
  for (const article of articles) {
    groups.set(article.category, [...(groups.get(article.category) ?? []), article]);
  }

  return [...groups.entries()]
    .map(([label, group]) => {
      const averageWeight = group.reduce((total, article) => total + article.weight, 0) / group.length;
      const score = Math.min(92, Math.round(46 + group.length * 7 + averageWeight * 12));
      return {
        id: `live-${countryCode.toLowerCase()}-${label.toLowerCase().replace(/\W+/g, "-")}`,
        countryCode,
        label,
        score,
        summary: `${group.length} live article${group.length === 1 ? "" : "s"} point to ${label.toLowerCase()} as an active market signal.`,
        impactSummary: `Live GDELT coverage is flagging ${label.toLowerCase()} developments. Treat this as a discovery signal until the article is manually reviewed or summarized by the LLM.`,
        articles: group.sort((a, b) => b.weight - a.weight).slice(0, 8)
      };
    })
    .sort((a, b) => b.score - a.score);
}

function inferCountryCode(article: GdeltArticle, text: string) {
  const sourceCode = article.sourcecountry ? COUNTRY_NAME_TO_CODE[article.sourcecountry] : undefined;
  if (sourceCode) return sourceCode;

  const normalized = ` ${text.toLowerCase()} `;
  return Object.entries(COUNTRY_KEYWORDS).find(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))?.[0] ?? null;
}

function inferCategory(text: string) {
  const normalized = text.toLowerCase();
  if (hasAny(normalized, ["oil", "gas", "lng", "opec", "pipeline", "electricity", "power grid", "energy"])) return "Energy";
  if (hasAny(normalized, ["semiconductor", "chip", "chips", "ai", "export control", "foundry"])) return "Technology";
  if (hasAny(normalized, ["tariff", "sanction", "trade", "export", "import", "supply chain", "customs"])) return "Supply Chain";
  if (hasAny(normalized, ["central bank", "inflation", "interest rate", "currency", "fed ", "ecb", "boj", "yen"])) return "Policy";
  if (hasAny(normalized, ["conflict", "attack", "military", "missile", "drone", "unrest", "protest"])) return "Defense";
  if (hasAny(normalized, ["shipping", "port", "freight", "cargo", "maritime", "suez", "hormuz"])) return "Supply Chain";
  return "Financial Markets";
}

function inferWeight(text: string) {
  const normalized = text.toLowerCase();
  let weight = 0.85;
  if (hasAny(normalized, ["urgent", "breaking", "attack", "sanction", "tariff", "shutdown", "strike"])) weight += 0.35;
  if (hasAny(normalized, ["oil", "inflation", "central bank", "semiconductor", "shipping", "supply chain"])) weight += 0.28;
  if (hasAny(normalized, ["market", "stocks", "currency", "bond", "prices", "exports"])) weight += 0.2;
  return Math.min(2, Number(weight.toFixed(2)));
}

function marketReasonFor(category: string, countryCode: string) {
  const country = sampleSnapshot.countries.find((item) => item.code === countryCode)?.name ?? countryCode;
  return `${category} coverage can change positioning for ${country}-linked equities, currencies, commodities, or supply-chain exposures.`;
}

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function parseGdeltDate(value: string | undefined) {
  if (!value) return new Date().toISOString();
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();

  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return new Date().toISOString();

  const timestamp = Date.UTC(
    Number(digits.slice(0, 4)),
    Number(digits.slice(4, 6)) - 1,
    Number(digits.slice(6, 8)),
    digits.length >= 10 ? Number(digits.slice(8, 10)) : 0,
    digits.length >= 12 ? Number(digits.slice(10, 12)) : 0,
    digits.length >= 14 ? Number(digits.slice(12, 14)) : 0
  );

  return Number.isNaN(timestamp) ? new Date().toISOString() : new Date(timestamp).toISOString();
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}

function hashish(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
