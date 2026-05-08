import type { CommandCenterSnapshot } from "../types/domain";

const now = new Date().toISOString();

export const sampleSnapshot: CommandCenterSnapshot = {
  lastRefresh: now,
  indexes: [
    { symbol: "DJI", name: "Dow Jones", value: "39,128.84", change: -0.42, updatedAt: now },
    { symbol: "SPY", name: "S&P 500", value: "5,214.09", change: 0.63, updatedAt: now },
    { symbol: "IXIC", name: "Nasdaq", value: "16,340.87", change: 0.88, updatedAt: now }
  ],
  countries: [
    {
      code: "USA",
      name: "United States",
      continent: "North America",
      centroid: [-98.5795, 39.8283],
      categories: [
        {
          id: "usa-tech",
          countryCode: "USA",
          label: "Technology",
          score: 82,
          summary: "Semiconductor and AI infrastructure demand remain constructive despite policy noise.",
          impactSummary:
            "AI capex, chip supply, and cloud infrastructure reporting create a favorable setup for directional trades, with tariff headlines as the main volatility source.",
          articles: [
            {
              id: "a-usa-1",
              title: "Chip suppliers report strong backlog from hyperscale buyers",
              source: "Market Wire",
              url: "https://example.com/chip-backlog",
              publishedAt: now,
              countryCode: "USA",
              category: "Technology",
              summary: "Large cloud buyers are keeping orders elevated for advanced compute components.",
              marketReason:
                "Sustained backlog supports revenue visibility for suppliers and can lift related equities.",
              weight: 1.72
            },
            {
              id: "a-usa-2",
              title: "Regulators open new review into platform bundling",
              source: "Policy Desk",
              url: "https://example.com/platform-review",
              publishedAt: now,
              countryCode: "USA",
              category: "Technology",
              summary: "A new review creates headline risk for large software platforms.",
              marketReason:
                "The action matters but is unlikely to change near-term earnings without enforcement timelines.",
              weight: 0.88
            }
          ]
        },
        {
          id: "usa-energy",
          countryCode: "USA",
          label: "Energy",
          score: 58,
          summary: "Inventory and shipping signals are mixed, keeping conviction moderate.",
          impactSummary:
            "Crude inventory draws are supportive, but demand uncertainty and refinery maintenance limit confidence.",
          articles: [
            {
              id: "a-usa-3",
              title: "Crude inventories fall while refinery utilization softens",
              source: "Energy Note",
              url: "https://example.com/crude-inventory",
              publishedAt: now,
              countryCode: "USA",
              category: "Energy",
              summary: "Inventories declined as refinery usage fell below seasonal averages.",
              marketReason: "The draw supports prices, but weaker utilization offsets part of the signal.",
              weight: 1.08
            }
          ]
        }
      ]
    },
    {
      code: "CHN",
      name: "China",
      continent: "Asia",
      centroid: [104.1954, 35.8617],
      categories: [
        {
          id: "chn-manufacturing",
          countryCode: "CHN",
          label: "Manufacturing",
          score: 47,
          summary: "Export demand and property-linked orders remain weak.",
          impactSummary:
            "Factory data indicates pressure in cyclical demand, making broad long exposure low conviction until new stimulus appears.",
          articles: [
            {
              id: "a-chn-1",
              title: "Factory survey misses expectations as exporters report slower orders",
              source: "Asia Macro",
              url: "https://example.com/factory-survey",
              publishedAt: now,
              countryCode: "CHN",
              category: "Manufacturing",
              summary: "A private factory gauge softened due to weaker export orders.",
              marketReason: "Lower export momentum can pressure industrials and regional supply-chain names.",
              weight: 1.61
            }
          ]
        }
      ]
    },
    {
      code: "DEU",
      name: "Germany",
      continent: "Europe",
      centroid: [10.4515, 51.1657],
      categories: [
        {
          id: "deu-industrials",
          countryCode: "DEU",
          label: "Industrials",
          score: 71,
          summary: "Defense and grid spending support orders while autos remain uneven.",
          impactSummary:
            "Industrial backlogs are improving in defense and infrastructure suppliers, though auto export weakness keeps the score below action threshold.",
          articles: [
            {
              id: "a-deu-1",
              title: "Grid equipment makers cite accelerated order pipeline",
              source: "Europe Markets",
              url: "https://example.com/grid-orders",
              publishedAt: now,
              countryCode: "DEU",
              category: "Industrials",
              summary: "Grid modernization projects are moving into procurement faster than expected.",
              marketReason: "Order acceleration can improve earnings visibility for electrical equipment firms.",
              weight: 1.34
            }
          ]
        }
      ]
    },
    {
      code: "AUS",
      name: "Australia",
      continent: "Oceania",
      centroid: [133.7751, -25.2744],
      categories: [
        {
          id: "aus-materials",
          countryCode: "AUS",
          label: "Materials",
          score: 66,
          summary: "Iron ore demand is uncertain, but lithium supply discipline is improving.",
          impactSummary:
            "Materials have a tradable but mixed setup because China demand is still the largest swing factor.",
          articles: [
            {
              id: "a-aus-1",
              title: "Lithium producers slow expansion plans after price pressure",
              source: "Commodities Daily",
              url: "https://example.com/lithium-supply",
              publishedAt: now,
              countryCode: "AUS",
              category: "Materials",
              summary: "Several producers are delaying new supply to stabilize pricing.",
              marketReason: "Supply discipline can improve margins, but demand visibility remains uncertain.",
              weight: 1.19
            }
          ]
        }
      ]
    }
  ],
  interactions: [
    { id: "usa-deu", from: "USA", to: "DEU", correlation: "positive", intensity: 0.65, label: "AI hardware demand" },
    { id: "chn-aus", from: "CHN", to: "AUS", correlation: "uncertain", intensity: 0.84, label: "Commodity demand" },
    { id: "usa-chn", from: "USA", to: "CHN", correlation: "negative", intensity: 0.56, label: "Trade policy risk" }
  ],
  chat: [
    {
      id: "m-system",
      role: "assistant",
      content: "Command Center is ready. Add country, category, article, or plan context and ask for a market thesis.",
      createdAt: now
    }
  ]
};

export const continents = ["North America", "South America", "Europe", "Asia", "Africa", "Oceania"];

export const newsTypes = ["Financial Markets", "Disasters", "Policy", "Supply Chain", "Defense", "Energy"];
