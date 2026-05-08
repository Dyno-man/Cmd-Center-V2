# Context Handoff

## Goal

Command Center V2 is a desktop-first market intelligence dashboard. It should help inspect world news, country-level market effects, article/context weights, and AI-assisted trade plans.

## Product Intent From User

- Main view is a world map with market interaction arrows.
- Top strip shows major stock indexes.
- Filters control what news/interactions appear on the map.
- Clicking a country zooms/centers that country and opens a country information panel.
- Country panel lists market categories with score colors:
  - Red: `score <= 50`
  - Yellow: `50 < score <= 75`
  - Green: `75 < score <= 100`
- Clicking a category shows detailed market impacts and supporting articles/context.
- Clicking an article shows article summary, market impact reasoning, weight, and source link.
- Plus buttons add country/category/article context into chat.
- Chat uses OpenRouter for multi-model LLM capabilities.
- Skills are markdown prompts invoked with slash commands.
- `/finalize` creates a markdown plan of action.
- `/update_plan "plan name"` loads saved plans/results into chat context.
- SQLite is intended as the local source of truth.

## Current Implementation

- Stack: Tauri 2 + React 19 + Vite 7 + TypeScript + SQLite via `rusqlite`.
- Browser MVP is functional with sample data and localStorage fallback.
- Native Tauri commands exist for snapshots, settings, refresh, skills, plans, and SQLite initialization.
- Desktop shell compiles and launches.
- OpenRouter calls are currently made from the frontend service layer, using `.env` or settings-entered key.
- RSS scraping, finance API calls, and true scoring jobs are placeholders/future work.

## Key Files

- `src/App.tsx` - top-level dashboard state and interaction wiring.
- `src/components/WorldMap.tsx` - map surface, pins, and arrows.
- `src/components/CountryPanel.tsx` - country/category/article drill-in.
- `src/components/ChatPanel.tsx` - chat UI, settings, slash commands.
- `src/services/storage.ts` - Tauri command boundary plus browser fallback.
- `src/services/openRouter.ts` - OpenRouter chat request/fallback.
- `src/data/sampleData.ts` - sample countries, categories, articles, indexes.
- `src-tauri/src/lib.rs` - native command handlers.
- `src-tauri/schema.sql` - SQLite schema.
- `skills/finalize.md` and `skills/macro.md` - starter skills.

## Environment Notes

- Rust was installed with rustup.
- Tauri Linux packages were installed manually by the user after sudo was required.
- `npm run tauri dev` used port `1421` because an earlier Vite dev server was already using `1420`.
- Git is not currently usable in this workspace; `git status` reports that `.git` is not valid repo metadata.
