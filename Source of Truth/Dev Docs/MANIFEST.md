# Source Of Truth Manifest

## Original Product Inputs

- `document-export-5-8-2026-5_17_03-PM.md` - original written plan from Eraser.
- `All Figures.png` - combined export with GUI, filter, country drill-in, startup, and active sequence diagrams.
- `GUI.png` - dashboard layout concept.
- `GUI Filter Example.png` - dynamic filter popover concept.
- `While Interaction for Country Zoom View.png` - country zoom and drill-in flow.
- `Startup Sequence.png` - startup data flow.
- `Active Sequence.png` - active refresh/dedupe/display loop.
- `eraser-export-export-5-8-2026-5_17_04-PM.zip` - original export archive.

## Current Implementation Docs

- `README.md` - source-of-truth overview and read order.
- `CONTEXT_HANDOFF.md` - shortest useful handoff for a new context window.
- `IMPLEMENTATION_LOG.md` - what was built, verified, and fixed.
- `RUNBOOK.md` - commands and environment setup.
- `ARCHITECTURE.md` - current code architecture and data flow.
- `BACKLOG_FROM_CODEX.md` - tasks still needed from Codex's perspective.

## Root Project Files Created During Implementation

These files are not duplicated here because they are active project files:

- `README.md`
- `.env.example`
- `.gitignore`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig.json`
- `index.html`
- `src/`
- `src-tauri/`
- `skills/`

## Generated/Installed Files

These should generally not be hand-edited:

- `node_modules/`
- `dist/`
- `src-tauri/target/`

## Current Verification Commands

```bash
npm run build
cd src-tauri && source "$HOME/.cargo/env" && cargo check
source "$HOME/.cargo/env" && npm run tauri dev
```
