# Implementation Log

## What Was Added

### Project Scaffold

- Added `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.env.example`, and `.gitignore`.
- Installed frontend dependencies:
  - React
  - React DOM
  - Vite
  - TypeScript
  - Tauri API
  - Tauri CLI
  - lucide-react
  - clsx
  - d3 map dependencies: `d3-geo`, `d3-selection`, `d3-transition`, `d3-zoom`
  - local map data/decode dependencies: `topojson-client`, `world-atlas`
  - Markdown rendering dependencies: `react-markdown`, `remark-gfm`
  - React type packages

### Frontend

- Built a clickable MVP dashboard in React.
- Added a map-first layout with:
  - Real local SVG world map surface.
  - Country pins.
  - Positive/uncertain/negative interaction arrows.
  - Major index strip.
  - Filter bar and anchored filter popover.
  - Country information panel overlay inside the map.
  - Right-side AI chat room.
- Replaced the old CSS map approximation with a `world-atlas`/TopoJSON map rendered through d3 geographic projection.
- Added map interactions:
  - clickable modeled country shapes;
  - selected-country highlight;
  - drag pan;
  - mouse wheel zoom;
  - zoom in/out/reset buttons;
  - projected interaction arrows between country centroids.
- Changed the country selection layout to match the Eraser source-of-truth:
  - selected country zooms to the center-left of the map;
  - country drill-down panel appears center-right inside the map;
  - panel is nearly full map height with a small top/bottom inset;
  - panel appears only after a country is selected;
  - there is no explicit close/X button;
  - clicking the ocean or an unlinked/off-country area closes the panel and resets the map to the world view.
- Converted the GUI to dark mode across the app shell, map, filter bar, country drill-down panel, chat panel, inputs, buttons, and detail cards.
- Added country drill-in flow:
  - Country score cards.
  - Category impact view.
  - Article detail view.
  - Context add buttons.
- Added chat behavior:
  - Context bin.
  - OpenRouter settings panel.
  - Saved conversation selector.
  - New chat button that preserves the previous transcript.
  - `/finalize` command.
  - `/update_plan "plan name"` command.
  - Markdown skill expansion.
  - Assistant markdown rendering for formatted replies.
  - `Enter` to send and `Shift+Enter` for multiline drafts.
  - Expanded in-app chat modal for longer conversations.
  - Long-message wrapping and internal chat scrolling so chat content does not resize the map workspace.
  - Fallback assistant response when no OpenRouter key exists.
- Added first live-data refresh behavior:
  - App startup now renders archived/local data first and automatically launches a background live refresh/dedupe pass.
  - The top bar now reports loading, archived, fetching, deduping, ready, and failed refresh states.
  - Tauri `refresh_live_data` fetches CoinGecko and GDELT from Rust.
  - Native provider requests use an explicit app user-agent, browser-like accept headers, sequential GDELT lane spacing, and retry/backoff for rate limits.
  - Browser fallback still uses the frontend `liveData` service.
  - CoinGecko no-key market snapshot updates the top strip with BTC, ETH, SOL, and BNB.
  - GDELT no-key discovery pulls recent English market/geopolitical articles through energy, shipping, trade, monetary policy, semiconductors, and conflict lanes.
  - Live GDELT articles are normalized with country hints, text-first category inference, lane evidence, market relevance, canonical URL/title-fingerprint dedupe, accepted/rejected status, and rejection reason.
  - Article weights now use a deterministic `0.00` to `2.00` rubric and store/display weight reasons.
  - Category scores now use deduped count, average/max weight, freshness, and confidence signals instead of simple volume.
  - Native refresh persists provider runs, market rows, articles, and recomputed category scores in SQLite.
  - GDELT lane diagnostics are stored in `ingestion_runs.notes`.
  - Live categories replace matching sample categories while preserving sample country/map structure.
  - Empty desktop snapshots are normalized to the sample country shell so a clean SQLite DB still renders the map.
- Added MVP UI polish:
  - tighter dark operations-dashboard visual treatment;
  - clearer market cards and status indicators;
  - cleaner filter summary;
  - improved article lists, empty states, and weight-reason display.

### Native Tauri Shell

- Added `src-tauri/` Tauri project.
- Added Rust command handlers for:
  - `load_snapshot`
  - `save_snapshot`
  - `load_settings`
  - `save_settings`
  - `refresh_data`
  - `refresh_live_data`
  - `create_chat_thread`
  - `load_chat_threads`
  - `load_chat_messages`
  - `save_chat_message`
  - `send_openrouter_chat`
  - `load_skills`
  - `save_plan`
  - `load_plan`
  - `list_plans`
- Added temporary Tauri icon at `src-tauri/icons/icon.png`.
- Added Tauri capability config.

### SQLite

- Added `src-tauri/schema.sql`.
- Added native SQLite initialization using `rusqlite`.
- Added tables:
  - `app_state`
  - `settings`
  - `plans`
  - `skills`
  - `market_indexes`
  - `articles`
  - `category_scores`
  - `chat_messages`
  - `chat_threads`
  - `ingestion_runs`
- Current native commands persist snapshots, settings, plans, live market rows, live article discovery rows, category scores, chat threads/messages, and ingestion run records through SQLite.
- Article rows now include/backfill dedupe metadata (`canonical_key`, `content_fingerprint`) and weight metadata (`weight_reason`) for installed databases.

### Documentation

- Added root `README.md`.
- Added this `Source of Truth` documentation set.

## Verification Completed

### Frontend

```bash
npm run build
```

Result: passed.

After the map/dark-mode iteration, `npm run build` was re-run and passed.

After the chat interaction iteration, `npm run build` was re-run and passed. The build produced the standard Vite chunk-size warning for the main bundle.

After the first live-data iteration, `npm run build` was re-run and passed. A direct network smoke test returned HTTP 200 from CoinGecko and GDELT.

After moving live refresh into Tauri, `npm run build` and `cd src-tauri && cargo check` were re-run and passed.

After provider rejection fixes, `npm run build` and `cd src-tauri && cargo check` were re-run and passed. A direct smoke test returned HTTP 200 from CoinGecko with the new headers; GDELT still returned 429 when called immediately from the terminal, so native backoff was increased to wait at least six seconds on 429 responses.

After adding GDELT lanes, chat threads, and native OpenRouter chat, `npm run build` and `cd src-tauri && source "$HOME/.cargo/env" && cargo check` were re-run and passed. The build still reports the standard Vite chunk-size warning.

After the MVP finalization pass on May 9, 2026, `npm run build` and `cd src-tauri && cargo check` were re-run and passed. The build still reports the standard Vite chunk-size warning.

### Native Rust/Tauri

```bash
cd src-tauri
source "$HOME/.cargo/env"
cargo check
```

Result: passed.

### Desktop Dev App

```bash
source "$HOME/.cargo/env"
npm run tauri dev
```

Result: compiled and launched `target/debug/command-center`.

Latest browser dev server check:

```bash
npm run dev
```

Result: launched at `http://localhost:1420/` after port binding approval.

## Issues Encountered And Fixed

- Rust/Cargo was missing.
  - Installed via rustup.
- Linux Tauri system dependencies were missing.
  - User installed apt packages manually because sudo required an interactive password.
- `pkg-config`/DBus headers were missing.
  - Fixed by installed system packages.
- Tauri icon was missing.
  - Added `src-tauri/icons/icon.png`.
- Tauri CLI was missing.
  - Installed `@tauri-apps/cli`.
- Frontend React types were missing.
  - Installed `@types/react` and `@types/react-dom`.

## Known Implementation Shortcuts

- The map is now a real local SVG geography, but only the currently modeled sample countries are wired to app country data through a local ID mapping.
- The top market strip now uses live CoinGecko crypto prices on refresh, but broad equity index quote ingestion is not implemented yet.
- GDELT article discovery is live on refresh and persisted in SQLite, but RSS/news ingestion is not implemented yet.
- GDELT scoring now uses deterministic relevance, recency, source, country-specificity, and lane evidence signals, but LLM summarization/scoring has not been implemented as a backend job.
- Live article country/category assignment and score/weight values are deterministic discovery signals, not final LLM analysis.
- Skills are built-in in browser fallback and hardcoded in the native command for now; markdown file loading should be added.
- OpenRouter calls now prefer the native Tauri command. The frontend service remains as browser fallback.
