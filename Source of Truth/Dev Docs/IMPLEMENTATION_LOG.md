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
  - `/finalize` command.
  - `/update_plan "plan name"` command.
  - Markdown skill expansion.
  - Fallback assistant response when no OpenRouter key exists.

### Native Tauri Shell

- Added `src-tauri/` Tauri project.
- Added Rust command handlers for:
  - `load_snapshot`
  - `save_snapshot`
  - `load_settings`
  - `save_settings`
  - `refresh_data`
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
  - `articles`
  - `category_scores`
  - `chat_messages`
  - `ingestion_runs`
- Current native commands persist snapshots, settings, and plans through SQLite.

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
- Market data values are sample data with refresh simulation.
- RSS/news ingestion is not implemented yet.
- Scoring uses sample data; the LLM scoring rubric has not been implemented as a backend job.
- Skills are built-in in browser fallback and hardcoded in the native command for now; markdown file loading should be added.
- OpenRouter calls currently happen in the frontend, which is acceptable for MVP but not ideal for secret handling.
