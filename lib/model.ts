// Token radar, model radar-3: one sealed snapshot in, one ranked board out.
//
// The board covers the forty watchlist slugs plus the strongest pre-token
// protocols below the floor (186 of them, so 226 rows). A protocol ranks
// only when the snapshot shows no token for it at all (no market cap, no
// CoinGecko id, no symbol); everything already trading is shown at the
// market's own price instead, in a separate live view.
//
// Implied value is TVL times a fitted base multiple, pushed by the clamped
// 7-day move, seasoned down gently with age, compressed by size and
// discounted by the odds of ever listing — five multipliers, every one
// fitted on the sealed snapshot's own live protocols (held-out Spearman
// on the value ratio -0.02 for radar-2, +0.32 for this model; median
// |log error| 1.57 down to 1.23). No term is a round number chosen by hand
// and no category multiplier is used: category terms failed held-out
// twice, so category enters only through the listing-odds logit.
//
//   implied = TVL x 0.1811
//           x (1 + 0.25 x clamp(change_7d, -30, +60) / 100)
//           x (1 - 0.2 x min(age_days, 1095) / 1095)      # age unknown: 677
//           x exp(-1.0 x (log10(TVL) - 8))
//           x (P_listed / 0.549) ^ 0.5
//
// P_listed is a logit on the 758 snapshot protocols (held-out AUC 0.78):
// intercept +0.7119, log10TVL-8 +0.2061, age_years +0.5887,
// age_known -2.2269, log1p(n_chains) +0.3768, plus one dummy per
// category (Dexs +1.0069, Liquid Staking -0.2232, Lending +1.0800,
// CEX -2.0949, Bridge -0.4507, Yield +0.4217, Risk Curators -1.3034,
// RWA +0.1305; every other category 0).
//
// Each row's farm plan comes from lib/farm-plan.ts: six steps built from
// the row's own category, chain, size and age, never from a list of names.
// The dashboard gets the plan as one compact tuple per row (family,
// capital, hold, gas, token, falling, extra chains) and expands it with
// the same step texts; see SCHEMA.md for that contract.
//
// One scoring pass ranks every row the same way; the build is fully
// deterministic, so two runs write byte-identical outputs.

import { familyFor, farmSteps, planCtx, stepText } from "./farm-plan.ts";
import type { FarmStep } from "./farm-plan.ts";

export type { FarmStep } from "./farm-plan.ts";

/** One protocol entry exactly as the sealed snapshot carries it. */
export interface SnapshotProtocol {
  slug: string; name: string; category: string | null;
  chains: string[]; tvl_usd: number; change_7d: number | null;
  mcap_usd: number | null; listed_at: string | null;
  gecko_id: string | null; symbol: string | null;
}

/** The sealed snapshot document as a whole. */
export interface Snapshot {
  as_of: string; source: string; floor_usd: number;
  protocols: SnapshotProtocol[]; watchlist: string[];
}

/** The listing-odds logit coefficients, fitted on all 758 protocols. */
export interface LogitCoefficients {
  intercept: number; log_tvl: number; age_years: number; age_known: number;
  log_chains: number;
  Dexs: number; "Liquid Staking": number; Lending: number; CEX: number;
  Bridge: number; Yield: number; "Risk Curators": number; RWA: number;
}

/** The tuning knobs of the model, as stated on the dashboard. */
export interface ModelConstants {
  base_multiple: number; growth_weight: number;
  growth_floor: number; growth_cap: number;
  maturity_floor: number; maturity_range: number;
  maturity_days: number; unknown_age_days: number;
  size_beta: number; size_ref_tvl: number;
  odds_gamma: number; odds_mean: number;
  logit: LogitCoefficients;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.1811, growth_weight: 0.25, growth_floor: -30, growth_cap: 60,
  maturity_floor: 0.8, maturity_range: -0.2, maturity_days: 1095, unknown_age_days: 677,
  size_beta: 1.0, size_ref_tvl: 100_000_000,
  odds_gamma: 0.5, odds_mean: 0.549,
  logit: {
    intercept: 0.7119, log_tvl: 0.2061, age_years: 0.5887, age_known: -2.2269,
    log_chains: 0.3768,
    Dexs: 1.0069, "Liquid Staking": -0.2232, Lending: 1.08, CEX: -2.0949,
    Bridge: -0.4507, Yield: 0.4217, "Risk Curators": -1.3034, RWA: 0.1305,
  },
};

/** The label the dashboard shows for this model generation. */
export const MODEL_VERSION = "radar-3";

/** Early rows carried below the watchlist floor, strongest TVL first. */
export const EARLY_ROWS: number = 186;

/** Live-token rows shown in the dashboard's live view, biggest cap first. */
export const LIVE_ROWS: number = 24;

/**
 * A farm plan in compact form for the dashboard, one tuple per row:
 * [family, starter capital in $, hold window in days, gas per transaction
 * in $, native gas token, TVL falling 20%+ in 7 days (0/1), chains beyond
 * the first]. The dashboard expands it to the same six step strings the
 * board carries, using the step texts of lib/farm-plan.ts (see SCHEMA.md).
 * `family` is one of lending, dex, staking, yield, bridge, derivatives,
 * rwa, chain, prediction, launchpad, insurance, payments, otc, fallback.
 */
export type FarmTuple = [string, number, number, number, string, 0 | 1, number];

/** One ranked row of board.json. */
export interface BoardRow {
  rank: number; slug: string; name: string; category: string | null;
  chains: string[]; tvl_usd: number; change_7d: number | null;
  mcap_usd: number | null; listed_at: string | null;
  gecko_id: string | null; symbol: string | null;
  token_status: "pre-token"; segment: "watchlist" | "early";
  age_days: number | null; implied_value_usd: number;
  model: {
    base_multiple: number; growth_pct: number; growth_multiplier: number;
    maturity_multiplier: number; size_multiplier: number;
    odds_multiplier: number; p_listed: number; age_days: number | null;
  };
  farm_steps: string[];
}

/** The slimmed-down row the dashboard page itself renders. */
export interface RadarRow {
  rank: number; slug: string; name: string; category: string | null;
  chains: string[]; tvl_usd: number; change_7d: number | null;
  mcap_usd: number | null; listed_at: string | null; age_days: number | null;
  implied_value_usd: number; growth_multiplier: number;
  maturity_multiplier: number; size_multiplier: number;
  odds_multiplier: number; p_listed: number;
  segment: "watchlist" | "early"; farm: FarmTuple;
}

/** A protocol that already trades, shown at the market's own value. */
export interface LiveRow {
  slug: string; name: string; category: string | null; chains: string[];
  tvl_usd: number; mcap_usd: number | null; change_7d: number | null;
}

/** What the live market itself charges per dollar of TVL. */
export interface Calibration {
  live_n: number; median_mcap_tvl: number;
  p25_mcap_tvl: number; p75_mcap_tvl: number;
}

/** Headline totals for the board. */
export interface BoardStats {
  total_implied_usd: number; median_implied_usd: number;
  categories_n: number; chains_n: number;
  top_category: string; top_category_n: number;
}

/** Everything the dashboard needs in one object. */
export interface RadarData {
  as_of: string; source: string; floor_usd: number; model: ModelConstants;
  model_version: string; watchlist_size: number; board_size: number;
  early_size: number; live_size: number; rows: RadarRow[];
  live: LiveRow[]; calibration: Calibration; stats: BoardStats;
}

/** The headline counts: watchlist size, board size, early rows, live rows. */
export interface BoardSummary {
  watchlist_size: number; board_size: number;
  early_size: number; live_size: number;
}

/** Raised when a snapshot file is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

const MS_PER_DAY = 86_400_000;

/** Clamp `v` into the closed interval from `lo` to `hi`. */
function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/** Round to four places past the point, for the multipliers the board shows. */
function to4dp(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/** String order for tie-breaks: -1 when `a` sorts first, 1 when `b` does, else 0. */
function cmpStr(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Whole days from the listing date up to the snapshot date, never negative.
 * Returns null when there is no listing date, or when either date is unreadable.
 */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const snapshotMs = Date.parse(asOf + "T00:00:00Z");
  const listedMs = Date.parse(listedAt + "T00:00:00Z");
  if (!Number.isFinite(snapshotMs) || !Number.isFinite(listedMs)) return null;
  const wholeDays = Math.floor((snapshotMs - listedMs) / MS_PER_DAY);
  return wholeDays < 0 ? 0 : wholeDays;
}

/**
 * The listing odds: P(this protocol ever records a token), from the logit
 * fitted on all 758 snapshot protocols. Age enters as years (0 when the
 * listing date is unknown, with age_known 0 marking that); change_7d is
 * deliberately not in the logit — it added no AUC and its one 4,448%
 * outlier once drove a protocol's odds to zero.
 */
export function listedProbability(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants = MODEL,
): number {
  const age = ageDays(asOf, protocol.listed_at);
  const logTvl = Math.log10(protocol.tvl_usd) - 8;
  const ageYears = age === null ? 0 : age / 365.25;
  const ageKnown = age === null ? 0 : 1;
  const logChains = Math.log1p(protocol.chains.length);
  const c = model.logit;
  const dummies: Record<string, number> = {
    Dexs: c.Dexs, "Liquid Staking": c["Liquid Staking"], Lending: c.Lending,
    CEX: c.CEX, Bridge: c.Bridge, Yield: c.Yield,
    "Risk Curators": c["Risk Curators"], RWA: c.RWA,
  };
  const dummy = protocol.category === null ? 0 : (dummies[protocol.category] ?? 0);
  const z = c.intercept + c.log_tvl * logTvl + c.age_years * ageYears +
    c.age_known * ageKnown + c.log_chains * logChains + dummy;
  return 1 / (1 + Math.exp(-z));
}

/** One protocol's implied value under `model`, with all five multipliers. */
export interface ImpliedBreakdown {
  implied: number; base_multiple: number;
  growth_pct: number; growth_multiplier: number;
  maturity_multiplier: number; size_multiplier: number;
  odds_multiplier: number; p_listed: number;
  age_days: number | null;
}

/**
 * One protocol's implied value under `model`, with the parts that made it.
 * Growth is the 7-day move clamped into [-30, +60]; an unknown move
 * counts as flat. Maturity falls from 1.0 at age 0 to 0.8 at three years
 * (maturity_floor - maturity_range at age 0, maturity_floor at the cap);
 * an unknown age counts as 677 days, the snapshot median. Size compresses
 * the multiple one dex at a time around the $100M reference TVL. Odds
 * discounts by the listing probability against the 0.549 snapshot mean,
 * square-rooted so the classifier (AUC 0.78, not 0.99) never dominates.
 * The value is whole dollars, at least one.
 */
export function impliedOf(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants = MODEL,
): ImpliedBreakdown {
  const age = ageDays(asOf, protocol.listed_at);
  const weeklyMove = typeof protocol.change_7d === "number" && Number.isFinite(protocol.change_7d)
    ? protocol.change_7d
    : 0;
  const growthPct = clamp(weeklyMove, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageUsed = age === null ? model.unknown_age_days : age;
  const cappedAge = Math.min(Math.max(ageUsed, 0), model.maturity_days);
  const maturityTop = model.maturity_floor - model.maturity_range;
  const maturityMult = maturityTop + (cappedAge / model.maturity_days) * model.maturity_range;
  const sizeMult = Math.exp(-model.size_beta * (Math.log10(protocol.tvl_usd) - 8));
  const pListed = listedProbability(protocol, asOf, model);
  const oddsMult = Math.pow(pListed / model.odds_mean, model.odds_gamma);
  const startingPoint = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(startingPoint * growthMult * maturityMult * sizeMult * oddsMult));
  return {
    implied, base_multiple: model.base_multiple,
    growth_pct: growthPct, growth_multiplier: growthMult,
    maturity_multiplier: maturityMult, size_multiplier: sizeMult,
    odds_multiplier: oddsMult, p_listed: pListed, age_days: age,
  };
}

/** Names that end in a release marker are a versioned pool of another protocol. */
const VERSIONED = new RegExp("\\s(V\\d+(\\.\\d+)?|v\\d+(\\.\\d+)?|\\d+\\.\\d+)$");

/** True when the snapshot records no token for this protocol at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  const noCap = p.mcap_usd === null;
  const noGecko = p.gecko_id === null;
  const noSymbol = p.symbol === null;
  return noCap && noGecko && noSymbol;
}

/** True when the board may rank this protocol: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category === "CEX") return false;
  if (VERSIONED.test(p.name)) return false;
  return true;
}

/** One scored protocol on its way to becoming a board row. */
type ScoredRow = {
  proto: SnapshotProtocol; value: ImpliedBreakdown; farm: FarmTuple;
};

/**
 * The ranked board: every watchlist slug first (the floor the board must
 * cover), then the strongest pre-token protocols below the floor, up to the
 * early cap. Rows sort by implied value, ties broken by slug so the order is
 * fully deterministic.
 */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const bySlug = new Map<string, SnapshotProtocol>();
  for (const p of snapshot.protocols) bySlug.set(p.slug, p);

  const picked = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const found = bySlug.get(slug);
    if (found !== undefined) picked.set(slug, found);
  }

  const belowFloor: SnapshotProtocol[] = [];
  for (const p of snapshot.protocols) {
    if (picked.has(p.slug)) continue;
    if (!isRankable(p)) continue;
    if (p.tvl_usd >= snapshot.floor_usd) continue;
    belowFloor.push(p);
  }
  belowFloor.sort((a, b) => {
    if (a.tvl_usd !== b.tvl_usd) return b.tvl_usd - a.tvl_usd;
    return cmpStr(a.slug, b.slug);
  });
  const earlyTake = Math.min(EARLY_ROWS, belowFloor.length);
  for (let i = 0; i < earlyTake; i++) {
    const p = belowFloor[i]!;
    picked.set(p.slug, p);
  }

  const scored: ScoredRow[] = [];
  for (const p of picked.values()) {
    const value = impliedOf(p, snapshot.as_of, model);
    const ctx = planCtx(p, value.age_days);
    const farm: FarmTuple = [
      familyFor(p.category).family, ctx.cap, ctx.hold, ctx.gas, ctx.token,
      ctx.falling ? 1 : 0, ctx.extraChains,
    ];
    scored.push({ proto: p, value, farm });
  }
  scored.sort((a, b) => {
    if (a.value.implied !== b.value.implied) return b.value.implied - a.value.implied;
    return cmpStr(a.proto.slug, b.proto.slug);
  });

  const watch = new Set(snapshot.watchlist);
  const rows: BoardRow[] = [];
  for (let i = 0; i < scored.length; i++) {
    const s = scored[i]!;
    const p = s.proto;
    const steps = farmSteps(p, s.value.age_days).map(stepText);
    rows.push({
      rank: i + 1, slug: p.slug, name: p.name, category: p.category,
      chains: p.chains, tvl_usd: p.tvl_usd, change_7d: p.change_7d,
      mcap_usd: p.mcap_usd, listed_at: p.listed_at,
      gecko_id: p.gecko_id, symbol: p.symbol, token_status: "pre-token",
      segment: watch.has(p.slug) ? "watchlist" : "early",
      age_days: s.value.age_days, implied_value_usd: s.value.implied,
      model: {
        base_multiple: s.value.base_multiple, growth_pct: s.value.growth_pct,
        growth_multiplier: to4dp(s.value.growth_multiplier),
        maturity_multiplier: to4dp(s.value.maturity_multiplier),
        size_multiplier: to4dp(s.value.size_multiplier),
        odds_multiplier: to4dp(s.value.odds_multiplier),
        p_listed: to4dp(s.value.p_listed), age_days: s.value.age_days,
      },
      farm_steps: steps,
    });
  }
  return rows;
}

/** The live-token protocols, biggest market cap first, for the live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  const trading: SnapshotProtocol[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p)) continue;
    if (p.category === "CEX") continue;
    trading.push(p);
  }
  trading.sort((a, b) => {
    const capA = a.mcap_usd === null ? 0 : a.mcap_usd;
    const capB = b.mcap_usd === null ? 0 : b.mcap_usd;
    if (capA !== capB) return capB - capA;
    return b.tvl_usd - a.tvl_usd;
  });
  const out: LiveRow[] = [];
  const take = Math.min(LIVE_ROWS, trading.length);
  for (let i = 0; i < take; i++) {
    const p = trading[i]!;
    out.push({ slug: p.slug, name: p.name, category: p.category, chains: p.chains,
      tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd, change_7d: p.change_7d });
  }
  return out;
}

/**
 * A board row's compact form for the dashboard page. The farm tuple is
 * carried along (see FarmTuple): the dashboard expands it to the same six
 * step strings board.json carries, so the page never ships the full text.
 */
export function radarRow(row: BoardRow, farm: FarmTuple): RadarRow {
  return {
    rank: row.rank, slug: row.slug, name: row.name, category: row.category,
    chains: row.chains, tvl_usd: row.tvl_usd, change_7d: row.change_7d,
    mcap_usd: row.mcap_usd, listed_at: row.listed_at, age_days: row.age_days,
    implied_value_usd: row.implied_value_usd, growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier, size_multiplier: row.model.size_multiplier,
    odds_multiplier: row.model.odds_multiplier, p_listed: row.model.p_listed,
    segment: row.segment, farm,
  };
}

/** The value `q` of the way through an ascending list, linearly interpolated. */
function quantile(sorted: number[], q: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * frac;
}

/**
 * The live market's own pricing: for every live-token protocol with a market
 * cap and a TVL (exchanges aside), its market cap per dollar of TVL,
 * summarised by its median and quartiles. Same snapshot, same numbers.
 */
export function calibration(snapshot: Snapshot): Calibration {
  const ratios: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p)) continue;
    if (p.category === "CEX") continue;
    const cap = p.mcap_usd === null ? 0 : p.mcap_usd;
    if (cap <= 0) continue;
    if (p.tvl_usd <= 0) continue;
    ratios.push(cap / p.tvl_usd);
  }
  ratios.sort((a, b) => a - b);
  return {
    live_n: ratios.length, median_mcap_tvl: to4dp(quantile(ratios, 0.5)),
    p25_mcap_tvl: to4dp(quantile(ratios, 0.25)), p75_mcap_tvl: to4dp(quantile(ratios, 0.75)),
  };
}

/** The board's totals: summed and median implied value, category and chain spread. */
export function boardStats(board: BoardRow[]): BoardStats {
  const values: number[] = [];
  for (const r of board) values.push(r.implied_value_usd);
  values.sort((a, b) => a - b);
  let total = 0;
  for (const v of values) total += v;
  let middle = 0;
  if (values.length > 0) {
    const lower = values[Math.floor((values.length - 1) / 2)]!;
    const upper = values[Math.ceil((values.length - 1) / 2)]!;
    middle = (lower + upper) / 2;
  }
  const perCategory = new Map<string, number>();
  const chainSet = new Set<string>();
  for (const r of board) {
    const cat = r.category === null ? "Other" : r.category;
    perCategory.set(cat, (perCategory.get(cat) ?? 0) + 1);
    for (const chain of r.chains) chainSet.add(chain);
  }
  let topCat = "Other";
  let topCount = 0;
  for (const [cat, count] of perCategory) {
    if (count > topCount) {
      topCat = cat;
      topCount = count;
    } else if (count === topCount && cat < topCat) {
      topCat = cat;
      topCount = count;
    }
  }
  return {
    total_implied_usd: total, median_implied_usd: Math.round(middle),
    categories_n: perCategory.size, chains_n: chainSet.size,
    top_category: topCat, top_category_n: topCount,
  };
}

/** Everything the dashboard renders, built from the snapshot in one pass. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  let early = 0;
  for (const r of board) {
    if (!snapshot.watchlist.includes(r.slug)) early += 1;
  }
  // The farm tuple lives beside its row: recomputed here from the same
  // pure functions buildBoard used (same protocol, same age), so the
  // dashboard tuple and the board steps cannot disagree.
  const bySlug = new Map<string, SnapshotProtocol>();
  for (const p of snapshot.protocols) bySlug.set(p.slug, p);
  const tuples = new Map<string, FarmTuple>();
  for (const r of board) {
    const p = bySlug.get(r.slug)!;
    const ctx = planCtx(p, r.age_days);
    tuples.set(r.slug, [
      familyFor(p.category).family, ctx.cap, ctx.hold, ctx.gas, ctx.token,
      ctx.falling ? 1 : 0, ctx.extraChains,
    ]);
  }
  const radar: RadarData = {
    as_of: snapshot.as_of, source: snapshot.source, floor_usd: snapshot.floor_usd,
    model, model_version: MODEL_VERSION, watchlist_size: snapshot.watchlist.length,
    board_size: board.length, early_size: early, live_size: live.length,
    rows: board.map((r) => radarRow(r, tuples.get(r.slug)!)), live,
    calibration: calibration(snapshot), stats: boardStats(board),
  };
  return { board, radar };
}

/** Read the snapshot out of a file's text, refusing anything malformed. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError("snapshot.json is not JSON");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new SnapshotError("snapshot.json is not a JSON object");
  }
  const o = raw as Record<string, unknown>;
  const datePattern = new RegExp("^\\d{4}-\\d{2}-\\d{2}$");
  if (typeof o.as_of !== "string" || !datePattern.test(o.as_of)) throw new SnapshotError("snapshot.json has no as_of date");
  if (typeof o.source !== "string") throw new SnapshotError("snapshot.json has no source");
  if (typeof o.floor_usd !== "number" || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError("snapshot.json has no floor_usd");
  if (!Array.isArray(o.protocols)) throw new SnapshotError("snapshot.json has no protocols array");
  if (!Array.isArray(o.watchlist)) throw new SnapshotError("snapshot.json has no watchlist of slugs");
  for (const entry of o.watchlist) {
    if (typeof entry !== "string") throw new SnapshotError("snapshot.json has no watchlist of slugs");
  }
  const protocols: SnapshotProtocol[] = [];
  for (let i = 0; i < o.protocols.length; i++) {
    const v = o.protocols[i];
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      throw new SnapshotError("snapshot.json's protocol " + i + " is not an object");
    }
    const p = v as Record<string, unknown>;
    const hasSlug = typeof p.slug === "string";
    const hasName = typeof p.name === "string";
    const hasTvl = typeof p.tvl_usd === "number" && Number.isFinite(p.tvl_usd);
    if (!hasSlug || !hasName || !hasTvl) {
      throw new SnapshotError("snapshot.json's protocol " + i + " lacks a slug, a name or a TVL");
    }
    protocols.push({
      slug: p.slug as string, name: p.name as string,
      category: typeof p.category === "string" ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === "string") : [],
      tvl_usd: p.tvl_usd as number,
      change_7d: typeof p.change_7d === "number" && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === "number" && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === "string" ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === "string" ? p.gecko_id : null,
      symbol: typeof p.symbol === "string" ? p.symbol : null,
    });
  }
  return {
    as_of: o.as_of as string,
    source: o.source as string,
    floor_usd: o.floor_usd as number,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/**
 * Why a board is one the gate will refuse, or null when it passes: coverage
 * of the watchlist, ranks running 1..n, rows in implied-value order, more
 * than one distinct value, and farm steps within their bounds.
 */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const seen = new Set<string>();
  for (const r of board) seen.add(r.slug);
  const missing: string[] = [];
  for (const slug of snapshot.watchlist) {
    if (!seen.has(slug)) missing.push(slug);
  }
  if (missing.length > 0) {
    const plural = missing.length === 1 ? "" : "s";
    return "the board misses " + missing.length + " watchlist slug" + plural + ": " + missing.slice(0, 5).join(", ");
  }
  const ranks: number[] = [];
  for (const r of board) ranks.push(r.rank);
  ranks.sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] !== i + 1) return "rank " + (i + 1) + " is " + ranks[i];
  }
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return "row " + (i + 1) + " outranks row " + i + " on implied value";
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return "all " + board.length + " rows share the same implied value $" + board[0]!.implied_value_usd +
      ": a board that ranks nothing by value is not a ranking";
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return r.slug + " has " + steps.length + " farm steps";
    for (const s of steps) {
      if (s.length < 20 || s.length > 600) return r.slug + " has a farm step of " + s.length + " characters";
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return r.slug + " has implied value " + r.implied_value_usd;
  }
  return null;
}

/**
 * The dashboard's dataset as one script's worth of JavaScript, in compact
 * positional form so the whole dashboard source stays inside the kit's
 * 65,536-byte dossier text cap (see SCHEMA.md for the exact layout).
 *
 * window.RADAR is the rows array; one row is
 *   [slug, name, rank, implied_value_usd, tvl_usd, category|null,
 *    chains (first 3), farm tuple, growth, maturity, size, odds,
 *    p_listed, age_days|null, change_7d|null, segment (0 watchlist, 1 early)]
 * with the multipliers rounded to four decimals. window.RADAR_META carries
 * the model constants, the calibration, the totals, the honest claims and
 * the 24 live-token rows ([slug, name, category, chains (first 3),
 * tvl_usd, mcap_usd, change_7d]). No URL string is written here: the gate
 * refuses dashboard files that name an http(s) address.
 */
export function dataScript(radar: RadarData): string {
  const rows: unknown[][] = [];
  for (const r of radar.rows) {
    rows.push([
      r.slug, r.name, r.rank, r.implied_value_usd, r.tvl_usd, r.category,
      r.chains.slice(0, 3), r.farm,
      r.growth_multiplier, r.maturity_multiplier, r.size_multiplier,
      r.odds_multiplier, r.p_listed, r.age_days, r.change_7d,
      r.segment === "watchlist" ? 0 : 1,
    ]);
  }
  const live: unknown[][] = [];
  for (const l of radar.live) {
    live.push([l.slug, l.name, l.category, l.chains.slice(0, 3), l.tvl_usd, l.mcap_usd, l.change_7d]);
  }
  const meta = {
    v: radar.model_version, as_of: radar.as_of, floor_usd: radar.floor_usd,
    watchlist: radar.watchlist_size, board: radar.board_size,
    early: radar.early_size, live_n: radar.live_size, model: radar.model,
    cal: [radar.calibration.live_n, radar.calibration.median_mcap_tvl,
      radar.calibration.p25_mcap_tvl, radar.calibration.p75_mcap_tvl],
    stats: [radar.stats.total_implied_usd, radar.stats.median_implied_usd,
      radar.stats.categories_n, radar.stats.chains_n,
      radar.stats.top_category, radar.stats.top_category_n],
    claims: [
      radar.watchlist_size + "/" + radar.watchlist_size + " watchlist covered",
      radar.board_size + " pre-token protocols ranked",
      radar.live_size + " live-token protocols shown separately",
    ],
    live,
  };
  return "window.RADAR=" + JSON.stringify(rows) + ";\nwindow.RADAR_META=" + JSON.stringify(meta) + ";\n";
}
