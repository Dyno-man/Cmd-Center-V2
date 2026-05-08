# Command Center V2

Command Center is a desktop-first market intelligence workspace for tracking world news, country-level market impact, article weighting, and AI-assisted trade planning.

## Current MVP

- Tauri + React project scaffold.
- Browser-runnable dashboard while the native shell is being compiled.
- Map-first command center UI with country selection and interaction arrows.
- Major index strip with refresh simulation.
- Dynamic filters for news type and continent.
- Country drill-in flow:
  - Category score cards.
  - Category impact summaries.
  - Article summaries, links, weights, and market reasoning.
- Right-side AI chat room with:
  - OpenRouter settings.
  - Context attachment from country/category/article panels.
  - `/finalize` plan generation.
  - `/update_plan "plan-name"` loading.
  - Markdown prompt skills.
- Tauri command skeleton for persisted snapshots, settings, skills, refresh, and saved plans.

## Setup

```bash
npm install
npm run dev
```

Open the printed Vite URL, usually `http://localhost:1420`.

For live OpenRouter calls, copy `.env.example` to `.env` and set:

```bash
VITE_OPENROUTER_API_KEY=sk-or-...
VITE_OPENROUTER_MODEL=openai/gpt-4.1-mini
```

You can also set the OpenRouter key and model from the in-app settings panel.

## Desktop Shell

The Tauri shell is scaffolded under `src-tauri/`. To run it, install Rust and the Tauri CLI, then use:

```bash
npm run tauri dev
```

The current native command layer stores JSON snapshots/settings/plans in the app data directory. The next backend milestone is replacing snapshot JSON with a normalized SQLite schema and adding real RSS/scrape and finance refresh jobs.

## Skills

Prompt skills live in `skills/` as markdown files. The MVP includes:

- `finalize`
- `macro`

The browser fallback has built-in copies of these skills. The native shell exposes a `load_skills` command that can be extended to read the markdown files directly.

## Next Engineering Milestones

- Add SQLite tables for articles, scores, countries, chats, plans, skills, ingestion runs, and settings.
- Implement RSS feed configuration and article scraping.
- Add a finance quote provider with cache/rate-limit handling.
- Move OpenRouter calls behind a Tauri command so secrets never need to be exposed to browser runtime code.
- Add automated component and command tests.
