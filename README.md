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

## Roadmap

**Phase 2 (planned):** a scheduled GitHub Action runs after the US market close, reads your holdings, fetches overnight moves and real headlines from free, no-key sources, and writes a briefing the app shows on open. Information only — reported as-is, no buy/sell recommendations.
