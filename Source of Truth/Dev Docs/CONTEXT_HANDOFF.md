# Context Handoff

## Goal

Command Center V2 is a desktop-first market intelligence dashboard. It should help inspect world news, country-level market effects, article/context weights, and AI-assisted trade plans.

## Product Intent From User

- Main view is a world map with market interaction arrows.
- Top strip shows major stock indexes.
- Filters control what news/interactions appear on the map.
- Clicking a country zooms it to the center-left of the map and opens a country information panel centered on the right side inside the map.
- Clicking off the selected country closes the country panel and resets the map back to the world view.
- Country panel lists market categories with score colors:
  - Red: `score <= 50`
  - Yellow: `50 < score <= 75`
  - Green: `75 < score <= 100`
- Clicking a category shows detailed market impacts and supporting articles/context.
- Clicking an article shows article summary, market impact reasoning, weight, weight reason, and source link.
- Plus buttons add country/category/article context into chat.
- Chat uses OpenRouter for multi-model LLM capabilities.
- Skills are markdown prompts invoked with slash commands.
- Assistant markdown is rendered as formatted chat content instead of raw markdown text.
- Chat composer sends on `Enter`; `Shift+Enter` inserts a newline.
- Chat can pop out into a larger in-app modal for longer planning conversations.
- `/finalize` creates a markdown plan of action.
- `/update_plan "plan name"` loads saved plans/results into chat context.
- SQLite is intended as the local source of truth.

## Current Implementation

- Stack: Tauri 2 + React 19 + Vite 7 + TypeScript + SQLite via `rusqlite`.
- Browser MVP is functional with sample data and localStorage fallback.
- Main GUI is a polished dark operations-dashboard style.
- `WorldMap` now uses a real local SVG world map built from `world-atlas`, `topojson-client`, `d3-geo`, and `d3-zoom`.
- Map supports country click targets, visible country pins, drag pan, wheel zoom, explicit zoom/reset controls, selected-country highlighting, and projected interaction arrows.
- Country drill-down is not a permanent layout column. It appears only after selecting a country and overlays the right side of the map.
- Chat message overflow is contained inside the chat scroll area so long messages do not stretch the main dashboard or affect the map.
- The right-side chat panel has an expanded modal mode that reuses the same conversation, context, settings, and composer state.
- Startup now loads archived/local data immediately and automatically launches a live refresh/dedupe pass in the background. Manual Refresh remains available as a retry/control.
- The top bar shows refresh status for loading archived data, fetching live data, deduping/scoring, ready, and failure states.
- Refresh now attempts a live-data pass from free/no-key APIs:
  - In Tauri, `refresh_live_data` fetches CoinGecko and GDELT from Rust, writes normalized rows to SQLite, recomputes category scores, and returns the frontend snapshot shape.
  - In browser mode, `src/services/liveData.ts` remains a frontend fallback for the same no-key sources.
  - CoinGecko updates the top market strip with BTC, ETH, SOL, and BNB prices/24h change.
  - GDELT pulls recent English market/geopolitical articles through six discovery lanes: energy, shipping, trade, monetary policy, semiconductors, and conflict.
  - Native GDELT fetches run sequentially with delay/backoff, store lane diagnostics in ingestion run notes, dedupe by canonical URL and normalized title/content fingerprint, score lane evidence, and keep accepted/rejected rows for audit.
  - Article category inference is text-first, with GDELT lane used as a fallback so lane names do not override article evidence.
  - Article weights are deterministic `0.00` to `2.00` values based on market relevance, lane evidence, recency, source quality, country specificity, and direct market linkage.
  - Weight reasons are stored/displayed when available in the article detail view and included when article context is attached to chat.
  - Category scores are recomputed from deduped articles using article count, average/max weight, freshness, and confidence rather than volume alone.
- Clean or empty desktop snapshots are normalized back to the sample country shell so the map remains usable before live data arrives.
- Native Tauri commands exist for snapshots, settings, refresh, skills, plans, and SQLite initialization.
- Chat now supports saved conversations. Starting a new chat creates a new thread and preserves the previous transcript in SQLite.
- OpenRouter chat calls now go through a native Tauri command first, with the browser service retained as fallback.
- Desktop shell compiles and launches.
- Assistant prompting defaults to plain cause/effect/action explanations: what is known, why it matters, what may happen next, what to do, and what would prove it wrong.
- RSS scraping and true LLM scoring/summarization jobs are placeholders/future work.

## Key Files

- `src/App.tsx` - top-level dashboard state and interaction wiring.
- `src/components/WorldMap.tsx` - local SVG map engine, pins, zoom/pan, country selection, and arrows.
- `src/components/CountryPanel.tsx` - country/category/article drill-in rendered as a map overlay from `App.tsx`.
- `src/components/ChatPanel.tsx` - chat UI, settings, slash commands, markdown rendering, Enter-to-send composer, and expanded modal.
- `src/services/liveData.ts` - browser fallback bridge for CoinGecko market snapshots, GDELT article discovery, fallback dedupe, and deterministic weighting.
- `src/services/storage.ts` - Tauri command boundary plus browser fallback.
- `src/services/openRouter.ts` - OpenRouter chat request/fallback.
- `src/data/sampleData.ts` - sample countries, categories, articles, indexes.
- `src-tauri/src/lib.rs` - native command handlers, live ingestion, migrations, dedupe, deterministic weighting, and category scoring.
- `src-tauri/schema.sql` - SQLite schema including article dedupe and weight metadata columns.
- `skills/finalize.md` and `skills/macro.md` - starter skills.

## Environment Notes

- Rust was installed with rustup.
- Tauri Linux packages were installed manually by the user after sudo was required.
- `npm run tauri dev` used port `1421` because an earlier Vite dev server was already using `1420`.
- During the latest MVP finalization pass, `npm run dev` launched at `http://localhost:1420/` after local port binding approval.
- `git status --short` is currently usable and shows the working tree changes.
