BUILD REPORT — token-radar-01

Model
- Base multiple: median mcap_usd/tvl_usd across tokenized protocols = 0.16908277872756614.
- implied value = round(tvl_usd × base × clamp(1 + change_7d/100, 0.55, 1.8) × (0.72 + 0.28 × exp(-age_days/900))).
- Age is derived from listed_at relative to snapshot as_of. No protocol names are hardcoded.

Board stats
- Rows: 200
- Watchlist coverage: 40/40
- Total implied value: $17,900,132,274
- Selection: all 40 watchlist tokenless protocols plus 160 additional tokenless protocols selected by TVL.

Verification
- init anchor: PASS
- deterministic two-output diff: PASS
- board row count/ranks/order: PASS
- watchlist coverage: PASS
- farm step count/length: PASS after final generation update
- dashboard URL grep: PASS (no http:// or https://)
- screenshots: PASS; Google Chrome headless real renders, each 1440x900 and 90,532–92,587 bytes.
- dossier generation: PASS via vendored buildDossier
- dashboard source limit: PASS; 64,031 bytes total (index.html + app.css + app.js + data.js); data.js is newline-delimited positional arrays.
- dossier text cutoff: PASS; no [Cut at note.
- dossier reproducibility: PASS; dossier.json byte-identical across fresh builds.
- Issue fixes: compact positional dashboard rows with 3 chains and exactly 3 concise farm steps; replaced placeholder screenshots with Chrome renders.

The requested app files, vendor library, output generation, and verification artifacts are contained under this app directory.
- Round 2 fixes: detail panel moved above board; instant scroll behavior:auto; Chrome captures regenerated with #p=robinhood and #filter=CEX.
- Final screenshots: 1-board.png 92282 bytes; 2-detail.png 56933 bytes; 3-filtered.png 85907 bytes; all 1440x900 and >50 KiB.
- Final verification: detail dump-dom PASS; filtered rows PASS; out1/out2 diff PASS; source 64043 bytes; dossier identical/no cutoff; dashboard URLs clean.
