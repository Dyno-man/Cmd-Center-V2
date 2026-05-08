# Architecture

## Stack

- Desktop shell: Tauri 2.
- Frontend: React 19, TypeScript, Vite 7.
- Native layer: Rust.
- Local database: SQLite through `rusqlite`.
- LLM gateway: OpenRouter.
- Icons: lucide-react.
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
- `ChatPanel` renders OpenRouter settings, context bin, messages, slash commands, and composer.

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
3. Native command currently updates refresh timestamp.
4. Browser fallback simulates index changes.
5. Future work should run RSS/news, finance, dedupe, summarization, and scoring jobs.

Chat:

1. User attaches context from country/category/article views.
2. User sends chat message or slash command.
3. `ChatPanel` expands markdown skill prompts when command matches a skill.
4. `sendOpenRouterChat` calls OpenRouter if key exists.
5. If no key exists, fallback response is returned.
6. `/finalize` saves the response as a plan.
7. `/update_plan "plan name"` loads a saved plan.

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
- Plans stored in `plans` and mirrored as markdown files in the app data `plans/` directory.

## SQLite Schema Intent

Tables are designed for the planned full app:

- `articles` stores scraped/ingested articles and LLM-generated impact metadata.
- `category_scores` stores country/category scoring outputs and evidence JSON.
- `chat_messages` stores chat history.
- `plans` stores finalized trading plans and updates.
- `skills` stores markdown skill content.
- `ingestion_runs` tracks API/RSS/scrape cycles.
- `settings` stores local app settings.
- `app_state` stores snapshot-style state during MVP transition.

## Important Current Boundary

The frontend still owns too much application logic for a production desktop app. The next architecture move should be to push ingestion, OpenRouter calls, scoring, and persistence fully into Tauri commands so the UI becomes a client of native services.
