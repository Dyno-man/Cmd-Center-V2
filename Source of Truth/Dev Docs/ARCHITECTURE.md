# Architecture

## Stack

- Desktop shell: Tauri 2.
- Frontend: React 19, TypeScript, Vite 7.
- Native layer: Rust.
- Local database: SQLite through `rusqlite`.
- LLM gateway: OpenRouter.
- First live data sources: CoinGecko and GDELT public APIs.
- Icons: lucide-react.
- Assistant markdown rendering: `react-markdown` with `remark-gfm`.
- Map rendering: local SVG geography through `world-atlas`, `topojson-client`, `d3-geo`, `d3-zoom`, `d3-selection`, and `d3-transition`.

## Frontend Shape

`src/App.tsx` owns the main state:

- Snapshot data.
- Selected country/category/article.
- Active filters.
- Attached chat context.
- Refresh state.

Main components:

- `MarketStrip` renders major index cards.
- `WorldMap` renders a local SVG world map, country click targets, pins, pan/zoom controls, selected-country focus, and interaction arrows.
- `FilterBar` renders news/continent filters.
- `CountryPanel` renders country, category, and article drill-in. It is mounted by `App.tsx` as an overlay inside the map only when a country is selected.
- `ChatPanel` renders OpenRouter settings, saved chat thread controls, context bin, messages, slash commands, markdown-formatted assistant replies, composer, and expanded chat modal.
- `liveData` remains the browser fallback for no-key live sources and maps them into the current snapshot-shaped frontend model.

## GUI And Map Behavior

- The app uses a dark-mode dashboard shell.
- The map owns the main workspace below the market strip. The country panel is not a permanent right column in the dashboard grid.
- Selecting a country:
  - clears any selected category/article;
  - highlights the country;
  - animates the map so the selected country is centered left;
  - opens the country panel centered on the right side inside the map.
- Clicking the ocean or an unlinked/off-country area:
  - closes the country panel;
  - clears country/category/article selection;
  - resets the map to the world view.
- Map controls:
  - zoom in;
  - zoom out;
  - reset world view;
  - drag pan;
  - mouse wheel zoom.
- Interaction arrows are projected between the source/target country centroids. Arrow color comes from correlation and visual intensity comes from the interaction intensity value.
- Current country geometry comes from `world-atlas`; the app still uses sample country metadata and a small `COUNTRY_ID_BY_CODE` mapping in `WorldMap` for the currently modeled countries.

## Data Flow

Startup:

1. Frontend calls `loadSnapshot()`.
2. If running inside Tauri, `load_snapshot` is invoked.
3. If not running inside Tauri or native command fails, browser fallback loads localStorage or sample data.
4. UI renders immediately from current snapshot.

Refresh:

1. User clicks Refresh.
2. Frontend calls `refreshData(snapshot)`.
3. In Tauri, `refresh_live_data` fetches CoinGecko and GDELT from Rust.
4. Native refresh records `ingestion_runs`, upserts `market_indexes`, upserts deduped `articles`, recomputes `category_scores`, and returns the same snapshot shape the UI already consumes.
5. In browser mode, or if the native command fails, `fetchLiveSnapshot` attempts the same no-key sources from the frontend service layer.
6. If all live requests fail, the app falls back to the existing local refresh behavior.
7. Future work should add RSS/news, broader finance quotes, dedupe improvements, summarization, and LLM scoring jobs.

Live data mapping:

- CoinGecko uses the no-key `/coins/markets` endpoint for BTC, ETH, SOL, and BNB.
- GDELT uses six English article discovery lanes: energy, shipping, trade, monetary policy, semiconductors, and conflict.
- Native provider requests include an explicit app user-agent, browser-like accept headers, sequential GDELT lane spacing, and retry/backoff handling for rate limits.
- GDELT rows are normalized with country hints, category inference, lane evidence score, market relevance, accepted/rejected status, rejection reason, and canonical URL dedupe.
- GDELT can store worldwide article rows, but the current map still only renders countries present in the frontend country snapshot.
- Clean desktop snapshots are normalized with the sample country shell so the map remains populated before live data arrives.

Chat:

1. User attaches context from country/category/article views.
2. User sends chat message or slash command. `Enter` submits and `Shift+Enter` inserts a newline.
3. `ChatPanel` expands markdown skill prompts when command matches a skill.
4. `sendOpenRouterChat` first invokes the native `send_openrouter_chat` command.
5. Native OpenRouter calls use saved settings and a plain cause/effect/action system prompt. If native invocation is unavailable, the browser fallback service runs.
6. If no key exists, fallback response is returned.
7. `/finalize` saves the response as a plan.
8. `/update_plan "plan name"` loads a saved plan.

Chat UI behavior:

- Assistant messages render markdown/GFM as formatted chat content.
- User messages remain plain preserved text.
- Long messages wrap inside message bubbles and scroll inside the chat message area instead of resizing the dashboard or map.
- The chat can open an in-app modal for longer conversations; the modal shares the same message, context, settings, busy, and draft state as the right-side panel.
- The chat header includes a new-chat control and a conversation selector. Starting a new chat creates a new thread and keeps the old transcript in SQLite.
- Assistant recommendations should explain: what is known, why it matters, what may happen next, what to do, and what would prove it wrong.

## Native Layer

Native command handlers live in `src-tauri/src/lib.rs`.

SQLite initialization uses:

```rust
include_str!("../schema.sql")
```

Current database path:

```text
<tauri app data dir>/command_center.sqlite3
```

Current native persistence:

- Snapshot JSON stored in `app_state`.
- App settings stored in `settings`.
- CoinGecko market strip rows stored in `market_indexes`.
- GDELT discovery articles stored in `articles`.
- GDELT article rows include provider, lane, canonical key, relevance score, lane evidence score, accepted/rejected flag, and rejection reason.
- Heuristic country/category discovery scores stored in `category_scores`.
- Provider fetch attempts stored in `ingestion_runs`.
- Chat threads stored in `chat_threads`; transcript rows stored in `chat_messages`.
- Plans stored in `plans` and mirrored as markdown files in the app data `plans/` directory.

## SQLite Schema Intent

Tables are designed for the planned full app:

- `articles` stores scraped/ingested articles and LLM-generated impact metadata.
- `market_indexes` stores top-strip market quote rows.
- `category_scores` stores country/category scoring outputs and evidence JSON.
- `chat_messages` stores chat history.
- `chat_threads` stores saved conversation metadata and lets the UI switch between transcripts.
- `plans` stores finalized trading plans and updates.
- `skills` stores markdown skill content.
- `ingestion_runs` tracks API/RSS/scrape cycles.
- `settings` stores local app settings.
- `app_state` stores snapshot-style state during MVP transition.

## Important Current Boundary

The frontend still owns too much application logic for a production desktop app. The next architecture move should be to push ingestion, OpenRouter calls, scoring, and persistence fully into Tauri commands so the UI becomes a client of native services.
