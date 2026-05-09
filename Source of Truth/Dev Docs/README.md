# Command Center Source of Truth

This folder is the handoff source for the current Command Center V2 build. It contains the original Eraser export assets plus the implementation notes needed to continue in a fresh context window.

## Read Order For A New Context

1. `CONTEXT_HANDOFF.md` - concise current-state summary.
2. `IMPLEMENTATION_LOG.md` - what was built and verified.
3. `RUNBOOK.md` - how to install, run, and check the app.
4. `ARCHITECTURE.md` - current frontend/native/data design.
5. `BACKLOG_FROM_CODEX.md` - what still needs to be added or completed.
6. `document-export-5-8-2026-5_17_03-PM.md` - original product plan.
7. PNG figures in this folder - original UI and flow diagrams.

## Current App Status

- React/Vite frontend exists and builds.
- Main GUI is dark mode and map-first.
- World map is now a real local SVG map with pan/zoom, country click targets, selected-country focus, and projected interaction arrows.
- Country drill-down appears as a right-side overlay inside the map after country selection.
- Tauri desktop shell exists and compiles.
- SQLite schema exists in `src-tauri/schema.sql`.
- OpenRouter chat integration prefers a native Tauri command, with frontend/browser fallback.
- Chat conversations can be started fresh while preserving previous transcripts in SQLite.
- CoinGecko and GDELT live fetching exist; GDELT uses six worldwide discovery lanes with heuristic relevance gating.
- Real RSS scraping and production LLM scoring are not implemented yet.

## Important Verification Status

Last verified on May 8, 2026:

```bash
npm run build
cd src-tauri && source "$HOME/.cargo/env" && cargo check
npm run tauri dev
```

The desktop dev command compiled and launched `target/debug/command-center`.
The latest frontend build after the map/dark-mode iteration passed with `npm run build`.
