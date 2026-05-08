# Runbook

## Prerequisites

### Node

Confirmed working:

```bash
node --version
npm --version
```

Observed versions:

```bash
node v24.13.1
npm 11.12.1
```

### Rust

Rust was installed with rustup.

Use this before Rust/Tauri commands if Cargo is not on PATH:

```bash
source "$HOME/.cargo/env"
```

Confirmed working:

```bash
rustc 1.95.0
cargo 1.95.0
```

### Linux Tauri Dependencies

The user installed the needed Ubuntu packages. If rebuilding the machine, run:

```bash
sudo apt-get update
sudo apt-get install -y pkg-config libdbus-1-dev libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev build-essential curl wget file
```

If `libwebkit2gtk-4.1-dev` is unavailable:

```bash
sudo apt-get install -y pkg-config libdbus-1-dev libwebkit2gtk-4.0-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev build-essential curl wget file
```

## Install Dependencies

```bash
npm install
```

## Run Browser MVP

```bash
npm run dev
```

Default URL:

```text
http://localhost:1420/
```

If the port is occupied, Vite will select the next available port.

## Run Desktop App

```bash
source "$HOME/.cargo/env"
npm run tauri dev
```

This starts Vite and then launches the Tauri desktop app.

## Build Frontend

```bash
npm run build
```

Expected result: TypeScript check and Vite production build pass.

## Check Tauri Backend

```bash
cd src-tauri
source "$HOME/.cargo/env"
cargo check
```

Expected result: Rust crate compiles.

## OpenRouter Setup

Option 1: local `.env`

```bash
cp .env.example .env
```

Set:

```bash
VITE_OPENROUTER_API_KEY=sk-or-...
VITE_OPENROUTER_MODEL=openai/gpt-4.1-mini
```

Option 2: in-app settings panel.

The in-app key currently persists locally. Long term, OpenRouter calls should move behind Tauri commands so the key is not exposed in frontend runtime code.

## Useful Commands

```bash
npm run build
cd src-tauri && source "$HOME/.cargo/env" && cargo check
source "$HOME/.cargo/env" && npm run tauri dev
```

## Current Runtime Note

During verification, `npm run tauri dev` used `http://localhost:1421/` because another Vite server was already using `1420`.
