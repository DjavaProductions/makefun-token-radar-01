# makefun-token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/DjavaProductions/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/DjavaProductions/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks the 40 pre-token protocols on DefiLlama's sealed watchlist —
plus 160 more below the $50M floor — by what their token launch would be worth,
and gives every one a seven-step farm plan with costs and times.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22.18 or later, standard library only, no network. It writes `board.json`
(200 ranked rows), `data.js`, a copy of `dashboard/` and `screenshots/`, and
`dossier.json` (via `vendor/makefun-board.ts`). Open `out/dashboard/index.html`
— the page renders with no network.

## How it ranks

`implied = round( TVL × 0.25 × (1 + clamp(7d growth, −60, 120) / 100 × 0.5) × (0.6 + min(age, 1095) / 1095 × 0.4) )`

One function scores every protocol; no name is special-cased. The 0.25 multiple
is the live market's own median: across the 119 live-token protocols in the
sealed snapshot the median market cap is 0.24× TVL, so a launch is priced at
the middle of what live tokens already fetch. Live-token protocols are set
aside with their market caps shown, never mixed into the ranking.

The dashboard is a filterable board (search, category, chain, watchlist/early
segment, sortable columns), a Top 10 spotlight, and a detail view per protocol
with the value breakdown, comparable live tokens, risk flags and the farm plan.

## What it does not claim

A protocol "records no token" — its DefiLlama record may still miss one.
Implied value is not a price, and not a prediction that a token launches.
No points program or airdrop is claimed for any protocol. The snapshot is
frozen at 2026-11-14; nothing here is live data.

## Files

- `main.ts` — entrypoint (Node 22): snapshot in, board + dashboard + dossier out
- `lib/model.ts` — the radar-2 model: ranking, calibration, stats, farm plans
- `vendor/makefun-board.ts` — make.fun's dossier library, verbatim
- `dashboard/` — the static page (index.html, app.css, app.js; no network)
- `screenshots/` — board, detail view, filtered view

## License

MIT.

---

<sub>Entered on [make.fun](https://make.fun/?ref=qvqxk6gb&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
