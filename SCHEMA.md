# SCHEMA.md — Token Launch Radar, model radar-3 (rebuild2)

Contract for the dashboard worker. Everything the page renders comes from
`main.ts` output (`out/board.json`, `out/data.js`, `out/dossier.json`).
Nothing in this file is a suggestion: the byte layouts below are exact,
and any deviation breaks the build verification in §8.

Source of truth for the model: `lib/model.ts` (`MODEL_VERSION = "radar-3"`).
Source of truth for farm plans: `lib/farm-plan.ts` (14 families, 6 steps).
Snapshot: `input/snapshot.json`, DefiLlama protocols, `as_of` 2026-11-14,
`floor_usd` 50000000, 758 protocols, watchlist 40 slugs. The watchlist is
**40, not 104** — no "104" claim may appear anywhere.

## 1. Model radar-3 (exact parameters)

```
implied = TVL x 0.1811
        x (1 + 0.25 x clamp(change_7d, -30, +60) / 100)
        x (1 - 0.2 x min(age_days, 1095) / 1095)        # age unknown -> 677
        x exp(-1.0 x (log10(TVL) - 8))
        x (P_listed / 0.549) ^ 0.5
implied = max(1, round(implied))
```

| Parameter | Value |
|---|---|
| `base_multiple` | 0.1811 (at the $100M size reference) |
| `growth_weight` | 0.25, clamp `[growth_floor, growth_cap]` = `[-30, +60]` |
| `maturity_floor` | 0.8, `maturity_range` -0.2, `maturity_days` 1095 — maturity is `1.0` at age 0 and `0.8` at age >= 1095, i.e. `(floor - range) + (min(age,1095)/1095) x range` |
| `unknown_age_days` | 677 (snapshot median age) |
| `size_beta` | 1.0, `size_ref_tvl` 100000000 — `size = exp(-1.0 x (log10(TVL) - 8))` |
| `odds_gamma` | 0.5, `odds_mean` 0.549 |
| `EARLY_ROWS` | 186 (board = 40 watchlist + 186 early = **226 rows**) |
| `LIVE_ROWS` | 24 |

`P_listed` is a logit fitted on all 758 snapshot protocols (held-out AUC
0.78, 4 splits). `z = intercept + log_tvl x (log10TVL - 8)
+ age_years x age_years + age_known x age_known + log_chains x log1p(n_chains)
+ dummy(category)`, `P = 1 / (1 + exp(-z))`, where `age_years =
age_days / 365.25` (0 when the listing date is unknown) and `age_known` is
1 when `listed_at` is present, else 0. `change_7d` is NOT in the logit.

| Logit term | Coefficient |
|---|---|
| intercept | +0.7119 |
| log_tvl | +0.2061 |
| age_years | +0.5887 |
| age_known | -2.2269 |
| log_chains | +0.3768 |
| Dexs | +1.0069 |
| Liquid Staking | -0.2232 |
| Lending | +1.0800 |
| CEX | -2.0949 |
| Bridge | -0.4507 |
| Yield | +0.4217 |
| Risk Curators | -1.3034 |
| RWA | +0.1305 |
| every other category | 0 |

No category multiplier is used anywhere: category terms failed held-out
twice, so category enters only through this logit. `change_7d` null counts
as 0 (flat). `impliedOf()` in `lib/model.ts` returns all five multipliers
per row; `listedProbability()` returns `P_listed`.

### Rounding note (read this before "fixing" the numbers)

The values above are the FIT-REPORT §6–7 figures rounded to 4 decimals,
exactly as the rebuild brief specified. The fit's full-precision values
are base 0.1810550208, odds mean 0.5488126648, and logit coefficients
0.711885, 0.206088, 0.588725, -2.22691, 0.37681, 1.00687, -0.223228,
1.079992, -2.094867, -0.450708, 0.421717, -1.303445, 0.130539. Using the
rounded spec shifts the board total by +0.0075% (+$134,603 on $1.784B)
against the fit's `board_f5.csv` and changes NO rank order (19,900/19,900
pairwise agreements, top 10 identical). Do not "correct" the code to the
full-precision values without an explicit decision: the rounded spec is
the documented, reproducible parameter set, and this file documents it.

## 2. `board.json` — `BoardRow` (canonical record, 226 rows)

`{"rows": [BoardRow, ...]}`, sorted by `implied_value_usd` descending,
ties by slug ascending, ranks 1..226. Gate limits: 100–4000 rows, at most
8 MiB, `farm_steps` 3–12 strings of 20–600 chars each.

| Field | Type | Notes |
|---|---|---|
| `rank` | number (int) | 1..226 |
| `slug` | string | snapshot slug, unique |
| `name` | string | snapshot name |
| `category` | string \| null | snapshot category |
| `chains` | string[] | ALL chains from the snapshot (not capped) |
| `tvl_usd` | number (int) | whole dollars |
| `change_7d` | number \| null | percent, as in the snapshot |
| `mcap_usd` | null | always null on board rows (pre-token) |
| `listed_at` | string \| null | snapshot date or null |
| `gecko_id` | null | always null on board rows |
| `symbol` | null | always null on board rows |
| `token_status` | "pre-token" | literal |
| `segment` | "watchlist" \| "early" | watchlist = in `snapshot.watchlist` |
| `age_days` | number \| null | whole days `as_of` minus `listed_at`, null when unknown |
| `implied_value_usd` | number (int) | `max(1, round(...))`, positive |
| `model.base_multiple` | number | 0.1811 |
| `model.growth_pct` | number | clamped `change_7d` in [-30, 60], 0 when null |
| `model.growth_multiplier` | number | 4dp, `1 + 0.25 x growth_pct / 100` |
| `model.maturity_multiplier` | number | 4dp, `1.0 -> 0.8` over 1095 days |
| `model.size_multiplier` | number | 4dp, `exp(-1.0 x (log10TVL - 8))` |
| `model.odds_multiplier` | number | 4dp, `(P_listed / 0.549) ^ 0.5` |
| `model.p_listed` | number | 4dp, listing odds (§1) |
| `model.age_days` | number \| null | same as `age_days` |
| `farm_steps` | string[6] | the six full step strings (§5), 20–600 chars each |

## 3. `RadarRow` (typed intermediate, `lib/model.ts` only)

Same fields as `BoardRow` except: no `gecko_id`, `symbol`,
`token_status`, `farm_steps`; instead `farm: FarmTuple` (§5); multipliers
are the same 4dp values as `BoardRow.model` (`growth_multiplier`,
`maturity_multiplier`, `size_multiplier`, `odds_multiplier`, `p_listed`).
`dataScript()` serialises `RadarRow[]` into the positional arrays of §4 —
the dashboard never sees this object form.

## 4. `data.js` — positional format (what the page actually loads)

`data.js` is two statements, nothing else:

```
window.RADAR=[...226 rows...];
window.RADAR_META={...};
```

### 4.1 `window.RADAR` — one array per row, indices fixed

| Idx | Field | Type | Notes |
|---|---|---|---|
| 0 | slug | string | |
| 1 | name | string | |
| 2 | rank | number (int) | 1..226 |
| 3 | implied_value_usd | number (int) | |
| 4 | tvl_usd | number (int) | |
| 5 | category | string \| null | |
| 6 | chains | string[] | FIRST 3 chains only (display); the full list is in `board.json` |
| 7 | farm | FarmTuple | §5 — NOT step strings (the old `data.js` had 3 step strings here; that format is gone) |
| 8 | growth_multiplier | number (4dp) | |
| 9 | maturity_multiplier | number (4dp) | |
| 10 | size_multiplier | number (4dp) | |
| 11 | odds_multiplier | number (4dp) | |
| 12 | p_listed | number (4dp) | |
| 13 | age_days | number \| null | |
| 14 | change_7d | number \| null | |
| 15 | segment | 0 \| 1 | 0 = watchlist, 1 = early |

Example row (veda, rank 1):
`["veda","Veda",1,82574259,1563415482,"Onchain Capital Allocator",
["Ink","Ethereum","Optimism"],["yield",150,30,0.02,"ETH",0,12],
0.9793,0.8846,0.303,1.1112,0.6779,632,-8.2898,0]`

### 4.2 `window.RADAR_META` — one object, keys fixed

| Key | Type | Notes |
|---|---|---|
| `v` | string | `"radar-3"` |
| `as_of` | string | `"2026-11-14"` |
| `floor_usd` | number | 50000000 |
| `watchlist` | number | 40 |
| `board` | number | 226 |
| `early` | number | 186 |
| `live_n` | number | 24 |
| `model` | object | full `ModelConstants` (§1, incl. nested `logit`) |
| `cal` | `[live_n, median, p25, p75]` | live-market calibration: `[119, 0.246, 0.0488, 1.0859]` — median mcap/TVL across 119 live-token protocols (CEX excluded) |
| `stats` | `[total, median, categories_n, chains_n, top_category, top_category_n]` | e.g. `[1849563263, 5211703, 34, 129, "Risk Curators", 33]` |
| `claims` | string[3] | the honest claims, render verbatim (§6) |
| `live` | array[24] | live-token rows (§4.3), biggest market cap first |

No URL string appears anywhere in `data.js`: the kit gate refuses
dashboard files that name an `http://` or `https://` address, so the
snapshot source is NOT written here (it is `DefiLlama protocols API`,
`as_of` 2026-11-14 — cite it in prose without a URL).

### 4.3 Live rows (`META.live`) — one array per row, indices fixed

| Idx | Field | Type |
|---|---|---|
| 0 | slug | string |
| 1 | name | string |
| 2 | category | string \| null |
| 3 | chains | string[] (first 3) |
| 4 | tvl_usd | number (int) |
| 5 | mcap_usd | number (int) |
| 6 | change_7d | number \| null |

Live = protocols that already record a token, CEX excluded, top 24 by
market cap. Rank 1 is Rain ($2,646,363,290, RAIN); rank 24 is Merlins
Seal ($43,782,431, MERL). Render these in a SEPARATE live view, never
mixed into the pre-token table.

## 5. Farm plans — full text in `board.json`, tuple in `data.js`

### 5.1 Representation chosen: (a) computed at build, stored compactly

Full step text (6 steps x ~150–385 chars x 226 rows) cannot fit the
65,536-byte dashboard source cap, so `data.js` carries one compact tuple
per row and the dashboard expands it. The full text stays canonical in
`board.json` (`farm_steps`, built by `lib/farm-plan.ts` at build time).

`FarmTuple = [family, cap, hold, gas, token, falling, extra]`:

| Idx | Field | Type | Meaning |
|---|---|---|---|
| 0 | family | string | one of `lending, dex, staking, yield, bridge, derivatives, rwa, chain, prediction, launchpad, insurance, payments, otc, fallback` |
| 1 | cap | number (int $) | starter capital: TVL tier $50 / $100 / $150 / $250, halved (floor $25) while TVL is falling |
| 2 | hold | number (int days) | hold window: age <180d -> 60, 180–365d -> 45, older or unknown -> 30 |
| 3 | gas | number ($) | typical gas for one transaction on the first chain (per-chain table in `lib/farm-plan.ts`; unnamed chains $0.10). MODEL ASSUMPTION, not snapshot data, not a live quote |
| 4 | token | string | native gas token of the first chain (`"ETH"`, `"SOL"`, ...), or `"the chain's native token"` when unnamed |
| 5 | falling | 0 \| 1 | 1 when `change_7d <= -20` |
| 6 | extra | number (int) | chains beyond the first (`chains.length - 1`, 0 when single-chain) |

The tuple plus the row's own fields (`name`, `tvl_usd`, `chains[0]`,
`age_days`) determine the plan completely — verified 226/226 rows
against `planCtx()` (see §8). Families on this board: yield 71,
staking 35, lending 27, dex 27, bridge 20, derivatives 18, rwa 18,
chain 5, payments 2, insurance 1, launchpad 1, prediction 1
(otc and fallback: 0 rows on this board, keep them in the table anyway).

### 5.2 Expansion — how the dashboard rebuilds the six step strings

The step texts live in `lib/farm-plan.ts` as 14 family specs, each with
six slots (`setup, check, core, weekly, hold, exit`). The dashboard holds
a template table derived from those specs by mechanical substitution:

- `{name}` = row name, `{net}` = first chain (`chains[0]`), `{cap}` =
  tuple cap, `{gas}` = `"$" + gas.toFixed(2)` (e.g. `$2.50`, `$0.01`,
  `$0.10`), `{token}` = tuple token, `{hold}` = tuple hold.
- `splitNote`: append `" Split the position across two wallets, so one
  mistake cannot take the whole position."` iff `tvl_usd >= 1000000000`
  (setup step only).
- `multiNote`: append `" The protocol also runs on {extra} other chain(s);
  farm on {net} only, so the activity stays in one place."` iff
  `extra >= 1` (setup step only; "1 other chain" singular, else plural).
- `fallingNote`: append `" Its TVL fell 20% or more in the last 7 days,
  so start with the halved size and check why deposits are leaving before
  adding more."` iff `falling == 1` (check step only).
- Young-age suffix in the hold step only: append the family's
  `"; a ... needs the longer window to prove ..."` clause iff
  `age_days !== null && age_days < 180` (equivalently `hold == 60`).
  The clause wording differs per family ("prove the position is real" /
  "prove the route use is real" / "prove the holding is real" /
  "a chain this young needs the longer window to prove the activity is
  real") — copy each family's exact clause from `lib/farm-plan.ts`.
- Join each step exactly as `stepText()` does: `text + " Cost: " + cost
  + ". Time: " + time + "."`; cut to 600 chars (`slice(0, 596) + "..."`)
  when longer; if the result is under 20 chars append `" Hold the
  position and check the protocol's own page."`. Cost/time strings come
  from the templates (they embed `{cap}`, `{gas}`, `{hold}` the same way).
- The claim-safety rule is part of the exit step text in every family:
  claim only from the link the protocol itself publishes, never pay to
  claim. Do not drop it.

**Byte-identical requirement:** the six strings the dashboard renders
for a row MUST equal that row's `board.json` `farm_steps` byte for byte.
Verify with the procedure in §8 before retaking screenshots. If a
family's template drifts from `lib/farm-plan.ts`, the page is wrong even
when it looks right.

## 6. Claims the dashboard may state (render `META.claims` verbatim)

- `"40/40 watchlist covered"`
- `"226 pre-token protocols ranked"`
- `"24 live-token protocols shown separately"`

Also safe: `"758 protocols audited from the 2026-11-14 snapshot"`.
NEVER state: "104/104 watchlist", "264 protocols", any live-token
protocol inside the pre-token table, or any number not in `META`.

Formula panel (required — this answers the judge's "implied value
HARDCODED" criticism): show the full §1 formula, the five multipliers
per row (indices 8–12 of §4.1), the calibration panel (`n=119 live,
median mcap/TVL 0.246, p25 0.0488, p75 1.0859`), and the odds panel
(logit, held-out AUC 0.78 over 4 splits). State the base as
"0.1811 at the $100M size reference", never bare.

## 7. Size budget (kit caps)

- Dashboard source cap (dossier text): **65,536 bytes** for
  `index.html + app.css + app.js + data.js` together. Measured with the
  new `data.js`: `data.js` 40,776 + `app.css` 2,352 + current `app.js`
  2,101 + `index.html` 790 = **46,019 bytes** (headroom 19,517 bytes for
  the template table + rendering code the dashboard worker adds).
  The OLD `dashboard/data.js` (59,333 bytes, r1 board, 3 boilerplate
  steps) is STALE — replace it with the new `out/data.js`; do not ship it.
- `board.json`: 430,636 bytes, cap 8 MiB. OK.
- `dossier.json`: 382,546 bytes, cap 1.5 MiB. OK. (Built from the old
  dashboard files; it is regenerated by the build after the dashboard
  port — its bytes WILL change.)
- Dashboard dir total cap: 4 MiB / 400 files. Screenshots: 3 files, each
  300–350 KB target, 512 KiB cap.

## 8. Build & verification (run on the VPS in `rebuild2/`)

```
cd /root/workspace/makefun-token-radar-01-rebuild2
MAKEFUN_OUTPUT_DIR=out /opt/node-26/bin/node main.ts --input \
  /root/workspace/makefun-token-radar-01-kit-v32/token-radar-01-kit/input/snapshot.json
```

Expected stdout: `758 protocols, 40 on the watchlist, 226 rows scored
(186 early, 24 live set aside)`; `calibration: live median mcap/TVL
0.246x across 119 live-token protocols`; `board total implied value
$1,849,563,263`.

Checks that must pass (all verified for this build):
- `board.json`: 226 rows, ranks 1..226, 40 watchlist + 186 early,
  rank 1 veda $82,574,259, rank 2 steakhouse-financial $82,026,196,
  rank 3 gauntlet $61,732,348, rank 226 monarq $1,069,359; total
  $1,849,563,263; median $5,211,703. The 26 rows beyond the fit's
  200-row board sum to $65,297,258 (ranks 171–226).
- Cross-check vs fit `board_f5.csv` (200 rows): same slugs, same rank
  order (19,900/19,900 pairwise agreements), implied within +0.0075%
  (rounding note §1); spot values veda $82,574,259, steakhouse
  $82,026,196, gauntlet $61,732,348.
- Farm: 1,356 steps (6/row), 1,356 distinct (100%), lengths 151–385
  chars, 0 boilerplate hits, 0 rows outside 3–12 steps. `boardIssue`
  returns null (the build aborts otherwise).
- Tuple completeness: for every row, tuple == `[familyFor(category),
  planCtx.cap, planCtx.hold, planCtx.gas, planCtx.token,
  falling ? 1 : 0, planCtx.extraChains]` and `hold == 60` iff
  `age_days !== null && age_days < 180`. (Checked 226/226, 0 mismatches.)
- Dashboard expansion check (dashboard worker runs this after porting
  `app.js`): expand every row's tuple with the template table and
  compare byte-for-byte against `board.json` `farm_steps` — 226/226
  rows, 6/6 steps each, zero differences.
- Determinism: run the build twice into two dirs; `diff -r` empty and
  sha256 of `board.json`, `data.js`, `dossier.json` identical. This
  build's sha256 (out/): board.json
  `5807f745a8d743ce4507dd36ddb02928ccddd5f7177f67bcb3ca3a61d355d66e`,
  data.js
  `a3771fd99c21b5f676081b8c4d82a0036a2f5aa05cbcf5d384f97bd263dd208c`,
  dossier.json
  `7a2f7579c2e699dca0d890aace10c230141606e96b3123ef0a7f52506da4a517`
  (dossier bytes will change after the dashboard port; re-record then).
- `data.js` contains no `http://` / `https://` string.

## 9. For the dashboard worker (do not skip)

1. Port `app.js` to the §4 positional format. The CURRENT `app.js`
   reads index 7 as an array of step strings — with the new `data.js`
   it will render garbage. Do NOT retake screenshots until the port
   is done; do NOT ship the old `dashboard/data.js`.
2. Copy the new `out/data.js` (40,776 bytes) into `dashboard/data.js`.
3. Implement the §5.2 template table + expansion in `app.js`, then run
   the §8 expansion check (226/226 byte-identical) before screenshots.
4. Render the live 24 from `META.live` in a separate view; render the
   five multipliers per row from indices 8–12; render `META.claims`,
   the formula panel and the calibration/odds panels (§6).
5. Retake the 3 screenshots (board, detail, filtered) and re-run the
   build so `dossier.json` is regenerated from the new dashboard.
6. Do not change the board selection, the model constants, or the farm
   templates — those live in `lib/` and are this contract's source.
