# REBUILD REPORT — Token Launch Radar, radar-3 / F5 dashboard (rebuild2)

Date: 2026-11-21. HEAD `4fdb895`. Work done only in
`/root/workspace/makefun-token-radar-01-rebuild2/` (scratch dir).
`lib/model.ts`, `lib/farm-plan.ts` and `main.ts` were NOT changed by this
rebuild (see §6). `main.ts` needed no change: the dossier regenerates
correctly from the new dashboard on its own.

## 1. Final model parameters (radar-3, from SCHEMA.md §1 / FIT-REPORT)

```
implied = TVL x 0.1811
        x (1 + 0.25 x clamp(change_7d, -30, +60) / 100)
        x (1 - 0.2 x min(age_days, 1095) / 1095)        # unknown age -> 677
        x exp(-1.0 x (log10(TVL) - 8))
        x (P_listed / 0.549) ^ 0.5
implied = max(1, round(implied))
```

- `base_multiple` 0.1811 (at the $100M size reference), `growth_weight`
  0.25, clamp `[-30, +60]`, `maturity_floor` 0.8 / range -0.2 / 1095 days,
  `unknown_age_days` 677, `size_beta` 1.0 / `size_ref_tvl` 100,000,000,
  `odds_gamma` 0.5 / `odds_mean` 0.549.
- Logit: intercept +0.7119, log_tvl +0.2061, age_years +0.5887,
  age_known -2.2269, log_chains +0.3768; Dexs +1.0069, Liquid Staking
  -0.2232, Lending +1.0800, CEX -2.0949, Bridge -0.4507, Yield +0.4217,
  Risk Curators -1.3034, RWA +0.1305; every other category 0.
  Held-out AUC 0.78 over 4 splits. `change_7d` is NOT in the logit.
- Board: 226 rows = 40 watchlist + 186 early, 24 live set aside.
  Total implied value $1,849,563,263; median $5,211,703.
  Rank 1 veda $82,574,259; rank 2 steakhouse-financial $82,026,196;
  rank 3 gauntlet $61,732,348; rank 226 monarq $1,069,359.
- Farm: 1,356 steps (6/row), 1,356 distinct (100%), lengths 151–385
  chars, 0 boilerplate. Families: yield 71, staking 35, lending 27,
  dex 27, bridge 20, derivatives 18, rwa 18, chain 5, payments 2,
  insurance 1, launchpad 1, prediction 1 (otc/fallback 0 rows).
  Falling-TVL rows 6, young (age < 180d) 49, TVL >= $1B 4, multi-chain 83.

## 2. What changed in the dashboard

`dashboard/data.js` — replaced the stale r1 file (59,333 bytes, 3
boilerplate step strings per row) with the new `out/data.js`
(40,776 bytes, §4 positional format, farm tuples).

`dashboard/app.js` — full port to the §4 format (was reading index 7
as step strings; that would have rendered garbage):
- Row mapping for all 16 positional indices, incl. the five
  multipliers (growth/maturity/size/odds/P_listed, indices 8–12).
- Farm expansion (§5.2): a template table derived mechanically from
  `lib/farm-plan.ts` — 14 families x 6 slots, with the shared
  setup/check/exit fragments factored out (common setup prefix,
  check prefix, claim tails, cost/time codes) and the conditional
  notes (split / multi-chain / falling / young-age) applied in code.
  The expander is exposed as `window.__expandFarm` so the §8 check
  can call it; it is not used for rendering anything else.
- Every board row shows TVL, 7d change, age, growth, maturity, size,
  odds and P(listed) in a strip under the row.
- Detail view: formula breakdown per row
  (`TVL x 0.1811 x growth x maturity x size x odds = implied`,
  P(listed), and a "vs board median" comparison line — the r1 code had
  no compare feature, so this is the comparison that now exists),
  plus the 6 expanded farm steps and the chain count (+N more).
- Live view: the 24 `META.live` rows in a separate section
  (Board / Live 24 toggle, `#view=live`), never mixed into the
  pre-token table.
- Claims rendered verbatim from `META.claims`; calibration and odds
  panels rendered from `META.cal` / `META.model.logit` (no hardcoded
  copies of those numbers in the page text).
- Kept: search, category filter, sort toggle, hash detail (`#p=`),
  hash filter (`#filter=`), Top 10 spotlight (new, cheap: first 10
  rows, clickable), existing cream/lime design.
- New: segment filter (Watchlist / Early).

`dashboard/index.html` — claims strip, three panels (formula /
calibration / odds), Top 10 strip, segment select, Board/Live
buttons, live section.

`dashboard/app.css` — styles for the new sections only (claims,
panels, formula box, Top 10, multiplier strip, live heading);
existing design untouched. One fix found by screenshot review: the
formula box was light-on-light inside the dark detail panel, so
`.formula` is now dark (`#26352b` bg, `#dfe9d9` text) in both places.

## 3. File sizes vs the cap

| File | Bytes |
|---|---|
| `dashboard/data.js` | 40,776 |
| `dashboard/app.js` | 18,790 |
| `dashboard/app.css` | 3,244 |
| `dashboard/index.html` | 2,006 |
| **Total** | **64,816 / 65,536** (headroom 720) |

Note on the cap: the raw total is not the whole story. The first
build at 65,502 bytes produced a dossier whose text was CUT
(`[Cut at 65536 bytes: 0 files and 422 bytes left out.]`) — the
dossier text carries ~316 bytes of framing over the raw files. The
dashboard was trimmed by ~700 bytes (mechanical
`document.querySelector` -> `Q()` alias, shorter panel prose) to
64,816 bytes; the final dossier text is 65,080 bytes with
**0 cut markers** and ends with the complete `index.html`.

## 4. sha256 of outputs (final build, `out/` == `out2/`)

```
5807f745a8d743ce4507dd36ddb02928ccddd5f7177f67bcb3ca3a61d355d66e  out/board.json   (unchanged from the model worker)
a3771fd99c21b5f676081b8c4d82a0036a2f5aa05cbcf5d384f97bd263dd208c  out/data.js      (unchanged from the model worker)
d4e25ffe0bd23b85b13d94631980723758d6be6734ee05f6184d2dd3b5ca8ace  out/dossier.json (NEW — regenerated from the new dashboard)
```

Dashboard files (`dashboard/` == `out/dashboard/`):
`app.js a243800e42a38f196fe8b21fec79fd970bd2724865a6d7372866612007471cbb`,
`app.css 27bfdca0ba1868907217e85e44773fa64a5631d5ab7e4ce6533f407d6189eb59`,
`index.html 0b499bc021ba11cd5e14885cf926a8f3a600a5104a6084a51d91f78613482253`,
`data.js a3771fd9…` (same as above).

Screenshots (`screenshots/` == `out/screenshots/`):
`1-board.png c7eda1dece40c2d0aa984c5ef0d65803383db691c28814a65ab8b42901f0a87d`,
`2-detail.png d23f566bef00513ac90405c8d3df3ab05acbb42b6ad03349bcb194b704bd5cea`,
`3-filtered.png 71af08f7ba41f3dad58bc3d9a3cf7884a075dc7f5444bb6c08bb447da64af20b`,
`4-live.png 1955a8da2c43b0de2df679d536824b06d2b0455277263bb55db7a119310be9f2`.

## 5. Farm expansion check (§8): 226/226

Harness `/tmp/check-expand.js` (also copied to `/tmp/` on the VPS):
loads `dashboard/data.js` + `dashboard/app.js` in a VM with DOM
stubs, calls `window.__expandFarm` for every row, compares
byte-for-byte against `out/board.json` `farm_steps`.

```
rows checked: 226, rows byte-identical: 226/226, steps mismatched: 0/1356
```

Run locally (node 24) and on the VPS (node 26.7.0), same result.
Two transcription bugs were caught by this check and fixed before
screenshots: the staking exit step is lowercase
("…then claim any points…", not "…then Claim…") and the bridge setup
step ends with a period ("…destination chain."). Both are now
byte-identical.

## 6. What was NOT changed

- `lib/model.ts` — already showed as modified in `git status` before
  this rebuild started (the model worker's F5 change, 229 insertions);
  untouched here.
- `lib/farm-plan.ts` — untouched.
- `main.ts` — untouched; no change was needed for the dossier to be
  correct (it regenerates from the new dashboard on its own).
- `/root/workspace/makefun-token-radar-01/` (original repo) — untouched.

## 7. Verification steps performed

1. `node main.ts` run twice (`MAKEFUN_OUTPUT_DIR=out` and `out2`,
   `/opt/node-26/bin/node`, snapshot
   `/root/workspace/makefun-token-radar-01-kit-v32/token-radar-01-kit/input/snapshot.json`):
   both print `758 protocols, 40 on the watchlist, 226 rows scored
   (186 early, 24 live set aside)`, calibration `0.246x across 119`,
   total `$1,849,563,263`. `diff -r out out2` empty; all three
   sha256 identical across runs.
2. Expansion check 226/226 (see §5), local + VPS.
3. DOM smoke test (node VM, no browser): board renders 226 rows,
   count 226, total $1.8B; claims verbatim; calib/odds/logit panels
   filled; Top 10 = 10 buttons; detail `#p=veda` shows with 6 steps
   and the exact formula `TVL $1,563,415,482 x 0.1811 x 0.9793 x
   0.8846 x 0.3030 x 1.1112 = $82,574,259`; live view 24 rows;
   filter `Risk Curators` = 33 rows.
4. Screenshots, Google Chrome 158 headless, 1440x900, all four
   visually inspected (see §8). No `http://` / `https://` string in
   any dashboard file (grep 0).
5. Dossier: 965,825 bytes (< 1.5 MiB), text 65,080 bytes, 0 cut
   markers, 4 images embedded, ends with complete `index.html`.

## 8. Screenshots (all 1440x900, in `screenshots/` and `out/screenshots/`)

| File | Size | Shows |
|---|---|---|
| `1-board.png` | 165,416 | Board: claims, formula/calibration/odds panels, Top 10, veda row 001 with multiplier strip |
| `2-detail.png` | 176,735 | Detail `#p=veda`: formula breakdown + 6 farm steps, rows 001–003 below |
| `3-filtered.png` | 167,186 | Filter `#filter=Risk Curators`: 33 rows, first Steakhouse Financial $82.0M |
| `4-live.png` | 162,542 | Live view: "Live tokens — set aside, never ranked", Rain $2.6B first |

Mechanism: 1/3/4 via `google-chrome --headless=new
--disable-gpu --no-sandbox --disable-dev-shm-usage --hide-scrollbars
--force-device-scale-factor=1 --window-size=1440,900
--virtual-time-budget=5000 --screenshot=…` on the `file://` URL.
2-detail via Chrome DevTools Protocol (`/tmp/shot-cdp.js`, node 26
built-in WebSocket): plain `--screenshot` captured a stale
pre-scroll frame for this URL (13,167 bytes, detail barely visible
at the bottom) even though the page logic was correct — CDP
confirmed `scrollY 750`, detail top ≈ 0, class `show`, 2,065 chars
of detail HTML — so the detail shot was taken through CDP
(`Page.captureScreenshot` after an explicit scroll), which renders
the scrolled page correctly.

## 9. Session / transcript (for bundling)

- This rebuild was done by subagent session
  `b1205d97-833b-4091-b24e-b0d016901f94` (label
  `dab09afe-a2c1-c87c-9914-fb7b6293c4ef`), spawned by the parent
  orchestrator. The full transcript lives in that session / the
  parent's conversation; the dashboard files were authored with the
  file write/edit tools in that session (local staging copy at
  `~/workspace/scratch-radar3/makefun-token-radar-01-rebuild2/`,
  then deployed to the VPS with tar/scp — no dashboard file was
  generated by a script).
- Helper scripts (not part of the deliverable): `/tmp/check-expand.js`
  (expansion check, also on the VPS at `/tmp/check-expand.js`),
  `/tmp/shot-cdp.js` (CDP detail screenshot, on the VPS at
  `/tmp/shot-cdp.js`).
- Note: two `exec` results during this session tripped the
  execution-risk flag; the task carried Mas's explicit approval to
  do git/build/copy in this repo despite the flag, so work continued
  as instructed.
