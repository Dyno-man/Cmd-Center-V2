# Backlog From Codex

This is the list of work I believe should be added or completed next, based on the current code and the original product plan.

## Highest Priority

1. Move OpenRouter calls behind Tauri commands.
   - Reason: API keys should not live in browser runtime code for the desktop app.
   - Add native command for chat completion.
   - Store/use OpenRouter settings from SQLite.
   - Keep frontend service as a thin invoke wrapper.

2. Replace snapshot persistence with normalized SQLite reads/writes.
   - Use the existing schema instead of storing most state as one JSON snapshot.
   - Add Rust query functions for countries, articles, category scores, chat messages, plans, and settings.
   - Keep snapshot only as a temporary compatibility layer until all UI queries are native-backed.

3. Implement RSS ingestion.
   - Add RSS source configuration.
   - Add ingestion run records.
   - Fetch RSS items on startup/refresh.
   - Deduplicate by canonical URL and content hash.
   - Store records in `articles`.

4. Implement article scraping/extraction.
   - Fetch article page content from RSS links.
   - Extract title, author/source if available, publish date, main text, and canonical URL.
   - Store raw content or extracted content carefully.

5. Implement LLM article summarization and weighting.
   - Summarize article.
   - Identify country/countries affected.
   - Identify market category.
   - Explain market impact.
   - Assign weight from `0.00` to `2.00`.
   - Store the reasoning.

6. Implement country/category scoring.
   - Use article summaries, weights, recency, source quality, and country/category grouping.
   - Score `0` to `100`.
   - Store evidence JSON and impact summary.
   - Render score updates in the country panel.

## Product Features To Complete

1. Expand the real map engine.
   - Current map uses local SVG geography and supports zoom/pan/click for modeled sample countries.
   - Replace the temporary `COUNTRY_ID_BY_CODE` mapping with complete ISO/country metadata.
   - Support click targets for all countries in the dataset.
   - Add country bounds/geometry metadata to the app data model instead of keeping map lookup logic in the component.

2. Real country database.
   - Add country metadata: ISO code, name, continent, centroid, geometry/bounds.
   - Use this for filters, map rendering, and article classification.

3. Dynamic interaction arrows.
   - Current arrows render on the real map but still use sample interaction data.
   - Generate arrows from article relationships, trade/policy tensions, supply-chain links, and cross-country effects.
   - Intensity should reflect interaction count and confidence.

4. Finance quote provider.
   - Add a free finance API.
   - Cache quotes.
   - Respect rate limits.
   - Store updates with timestamps.

5. Filter system.
   - Current filters only affect visible sample countries.
   - Add filters for news type, disaster, market category, continent, score band, source, recency, and confidence.
   - Apply filters consistently to map pins, arrows, country panels, and article lists.

6. Plan outcome loop.
   - `/finalize` saves a plan.
   - Still needed: trade result entry, after-action report, success/failure status, and learned scoring adjustments.

7. Skill file loading.
   - Native command currently returns hardcoded skills.
   - Load markdown files from `skills/` and/or app data directory.
   - Parse metadata frontmatter.
   - Allow adding/editing skills from the app later.

8. Settings screen.
   - Current settings are embedded in the chat panel.
   - Add a dedicated settings view for:
     - OpenRouter key.
     - Default model.
     - Finance API key/provider.
     - RSS sources.
     - Refresh interval.
     - Data directory.

## Engineering Work

1. Add tests.
   - Frontend component tests for drill-in, filters, chat commands, and settings.
   - Rust unit tests for DB initialization and command behavior.
   - Integration tests for ingestion/dedupe once implemented.

2. Add database migrations.
   - Current schema runs as `create table if not exists`.
   - Add explicit migration versioning before schema starts changing often.

3. Improve error handling.
   - Surface OpenRouter failures clearly in chat.
   - Surface ingestion failures in a status panel.
   - Track failed ingestion runs in SQLite.

4. Add loading and empty states.
   - Startup loading.
   - Refresh in progress.
   - No country data.
   - No articles.
   - Missing API keys.

5. Add UI polish and responsiveness.
   - Verify desktop and smaller screens with screenshots.
   - Continue refining map/panel responsive behavior, especially smaller screens.
   - Replace temporary Tauri icon.
   - Continue improving country panel scroll handling.
   - Chat scroll handling was improved for long messages and expanded conversations; future work should add automated visual regression coverage.

6. Add source control.
   - The current `.git` directory is not valid repo metadata.
   - Initialize or repair Git before serious iteration.
   - Commit scaffold separately from future feature work.

## Security And Privacy Work

1. Move all external API calls into native Tauri commands.
2. Avoid exposing API keys to frontend JS.
3. Consider OS keychain/secret storage for API keys.
4. Add allowlists/permissions for any future executable skill system.
5. Keep v1 skills as markdown prompts only until command execution safety is designed.

## Documentation Still Worth Adding Later

1. Data model ERD once normalized commands are implemented.
2. Prompt/rubric docs for article weighting and category scoring.
3. RSS source configuration guide.
4. OpenRouter model selection guide.
5. Trade plan template and after-action report template.
