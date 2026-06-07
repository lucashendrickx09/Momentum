# Momentum

A personal self-improvement tracker. Phone-friendly, installable PWA, **all data stored locally on your device** — nothing is sent to a server. Export/import a backup file any time.

Four areas, each with daily logging, full timestamped history, stats, streaks and trend charts:

- **💶 Financial** — active income log with a 6-month income goal, a game-project pipeline (idea → building → shipped → monetizing), portfolio holdings with buy-reason notes, and a savings / net-position line. Import holdings from a Google Sheet (published CSV URL) or a CSV upload.
- **✎ Education (IB)** — study hours per subject, predicted-vs-target grades, and deadline countdowns for IA / EE / TOK Exhibition / Individual Oral.
- **⚡ Physical** — workout consistency, a progressive-overload lift log (estimated 1RM), and weekly measurement notes. Built around consistency and strength, no calorie targets.
- **☾ Mental** — sleep (front and centre), daily mood/energy, and screen-time/focus.

## Tech

React 19 · Vite · TypeScript · zustand (persisted to `localStorage`) · React Router (HashRouter) · Recharts · vite-plugin-pwa.

## Develop

```bash
npm install
npm run dev        # start the dev server
npm run build      # typecheck + production build to dist/
npm run preview    # preview the production build
npm run icons      # regenerate PWA icons from public/favicon.svg
```

## Data & privacy

Everything lives in your browser's `localStorage` under the key `momentum-data`. There is no backend and no account. Use **Settings → Export** to download a JSON backup, and **Import** to restore it on another device or browser.

## Deploy (GitHub Pages)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes to GitHub Pages. The base path is derived automatically from your repository name, so the site serves at `https://<user>.github.io/<repo>/` whatever you call the repo.

One-time setup: in the repo, go to **Settings → Pages → Source: GitHub Actions**.

## Market briefing (scheduled)

A GitHub Action (`.github/workflows/briefing.yml`) runs on weekdays at 20:00 UTC (~04:00 Taiwan, after the US close), looks up a watchlist of tickers, and writes `public/briefing.json` with each ticker's latest move and a few real headlines from free, no-key Yahoo Finance endpoints. The app fetches that file on open and shows a dismissible **Market briefing** card on the Dashboard and Financial pages.

Information only — everything is reported as published ("reported by …"), with no buy/sell recommendations or predictions. The briefing never touches your local tracker data; it only knows the watchlist.

**Watchlist** — the job picks tickers from, in order:

1. A repo secret **`SHEET_CSV_URL`** (Settings → Secrets and variables → Actions), set to your published Google Sheet CSV — the same sheet you import holdings from. If set and it yields tickers, it wins.
2. Otherwise **`public/watchlist.json`** — edit the `tickers` array (Yahoo symbols, e.g. `AAPL`, `BTC-USD`, `ASML.AS`).

Run it locally with `npm run briefing` (writes `public/briefing.json`), or trigger it on GitHub via **Actions → Market briefing → Run workflow**. Note: some IPs hit a Yahoo regional consent gate; GitHub's US-based runners normally don't.

## Roadmap

Possible next steps: per-holding briefing detail, configurable schedule, and an in-app watchlist editor that writes to the sheet.
