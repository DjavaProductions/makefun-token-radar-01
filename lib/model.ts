// Token radar, model radar-2: one sealed snapshot in, one ranked board out.
//
// The board covers the forty watchlist slugs plus the strongest pre-token
// protocols below the floor. A protocol ranks only when the snapshot shows
// no token for it at all (no market cap, no CoinGecko id, no symbol);
// everything already trading is shown at the market's own price instead.
//
// Implied value is TVL times the base multiple (0.25, the live median),
// pushed by the clamped 7-day move and seasoned by age up to three years,
// rounded to whole dollars and floored at one. One scoring pass ranks every
// row the same way; each row's farm plan is built from its own category,
// chain, size and age, never from a list of names.

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

/** The tuning knobs of the model, as stated on the dashboard. */
export interface ModelConstants {
  base_multiple: number; growth_weight: number;
  growth_floor: number; growth_cap: number;
  maturity_floor: number; maturity_range: number;
  maturity_days: number; unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25, growth_weight: 0.5, growth_floor: -60, growth_cap: 120,
  maturity_floor: 0.6, maturity_range: 0.4, maturity_days: 1095, unknown_age_days: 365,
};

/** The label the dashboard shows for this model generation. */
export const MODEL_VERSION = "radar-2";

/** Early rows carried below the watchlist floor, strongest TVL first. */
export const EARLY_ROWS: number = 160;

/** Live-token rows shown in the dashboard's live view, biggest cap first. */
export const LIVE_ROWS: number = 24;

/** One step of a farm plan: what to do, what it costs, how long it takes. */
export interface FarmStep {
  text: string; cost: string; time: string;
}

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
    maturity_multiplier: number; age_days: number | null;
  };
  farm_steps: string[];
}

/** The slimmed-down row the dashboard page itself renders. */
export interface RadarRow {
  rank: number; slug: string; name: string; category: string | null;
  chains: string[]; tvl_usd: number; change_7d: number | null;
  mcap_usd: number | null; listed_at: string | null; age_days: number | null;
  implied_value_usd: number; growth_multiplier: number;
  maturity_multiplier: number; segment: "watchlist" | "early";
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
 * One protocol's implied value under `model`, with the parts that made it.
 * Growth is the 7-day move clamped into the model's band; an unknown move
 * counts as flat. Maturity grows with age up to three years; an unknown age
 * counts as one year. The value is whole dollars, at least one.
 */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const weeklyMove = typeof protocol.change_7d === "number" && Number.isFinite(protocol.change_7d)
    ? protocol.change_7d
    : 0;
  const growthPct = clamp(weeklyMove, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageUsed = age === null ? model.unknown_age_days : age;
  const cappedAge = Math.min(Math.max(ageUsed, 0), model.maturity_days);
  const maturityMult = model.maturity_floor + (cappedAge / model.maturity_days) * model.maturity_range;
  const startingPoint = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(startingPoint * growthMult * maturityMult));
  return { implied, growthPct, growthMult, maturityMult, age };
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
type ScoredRow = { proto: SnapshotProtocol; implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null };

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
    const v = impliedValue(p, snapshot.as_of, model);
    scored.push({ proto: p, implied: v.implied, growthPct: v.growthPct, growthMult: v.growthMult, maturityMult: v.maturityMult, age: v.age });
  }
  scored.sort((a, b) => {
    if (a.implied !== b.implied) return b.implied - a.implied;
    return cmpStr(a.proto.slug, b.proto.slug);
  });

  const watch = new Set(snapshot.watchlist);
  const rows: BoardRow[] = [];
  for (let i = 0; i < scored.length; i++) {
    const s = scored[i]!;
    const p = s.proto;
    const steps = farmSteps(p, s.age).map(stepText);
    rows.push({
      rank: i + 1, slug: p.slug, name: p.name, category: p.category,
      chains: p.chains, tvl_usd: p.tvl_usd, change_7d: p.change_7d,
      mcap_usd: p.mcap_usd, listed_at: p.listed_at,
      gecko_id: p.gecko_id, symbol: p.symbol, token_status: "pre-token",
      segment: watch.has(p.slug) ? "watchlist" : "early",
      age_days: s.age, implied_value_usd: s.implied,
      model: {
        base_multiple: model.base_multiple, growth_pct: s.growthPct,
        growth_multiplier: to4dp(s.growthMult), maturity_multiplier: to4dp(s.maturityMult), age_days: s.age,
      },
      farm_steps: steps,
    });
  }
  return rows;
}

/**
 * One farm step as a single string: the action, then its cost and time.
 * Over-long steps are cut to the gate's limit; a step too short to say
 * anything gets a holding instruction appended.
 */
export function stepText(step: FarmStep): string {
  const joined = step.text + " Cost: " + step.cost + ". Time: " + step.time + ".";
  const capped = joined.length > 600 ? joined.slice(0, 596) + "..." : joined;
  if (capped.length < 20) return capped + " Hold the position and check the protocol's own page.";
  return capped;
}

/** The first chain the protocol names, or a neutral fallback phrase. */
function firstChain(p: SnapshotProtocol): string {
  const head = p.chains[0];
  return head === undefined ? "its main chain" : head;
}

/** Capital tiers by TVL: the bigger the protocol, the bigger the position. */
const CAPITAL_TIERS: Array<[number, number]> = [[5_000_000_000, 250], [1_000_000_000, 150], [100_000_000, 100]];

/** How much capital one farm position needs, from the protocol's own TVL. */
function stakeSize(p: SnapshotProtocol): number {
  for (const [floor, size] of CAPITAL_TIERS) {
    if (p.tvl_usd >= floor) return size;
  }
  return 50;
}

/** Holding windows by age: younger protocols get a longer qualifying window. */
const HOLD_BANDS: Array<[number, number]> = [[180, 60], [365, 45]];

/** How long to hold, from the protocol's age; unknown age holds a month. */
function holdWindow(age: number | null): number {
  if (age === null) return 30;
  for (const [limit, days] of HOLD_BANDS) {
    if (age < limit) return days;
  }
  return 30;
}

/** True when the lower-cased category contains any of the given words. */
function hits(cat: string, ...words: string[]): boolean {
  for (const w of words) {
    if (cat.includes(w)) return true;
  }
  return false;
}

/**
 * The one action for a category, in words a farmer can follow. The checks
 * run narrow first: basis, curator and governance rows are matched before
 * the broad stable and RWA rows that would also catch them.
 */
function actionFor(p: SnapshotProtocol, cap: number, net: string): string {
  const c = (p.category ?? "").toLowerCase();
  const nm = p.name;
  if (hits(c, "lend", "cdp", "collateral")) return "Supply $" + cap + " of USDC to " + nm + " on " + net + " and keep the position open.";
  if (hits(c, "basis")) return "Deposit $" + cap + " of USDC into " + nm + "'s basis vault on " + net + " and keep the position open.";
  if (hits(c, "curator", "allocator")) return "Deposit $" + cap + " into a " + nm + " vault on " + net + " and keep the shares.";
  if (hits(c, "governance")) return "Deposit $" + cap + " of USDC into " + nm + " on " + net + ", then vote in its governance when a proposal opens.";
  if (hits(c, "dex", "yield", "leveraged farm")) return "Provide $" + cap + " of liquidity to " + nm + "'s main pool on " + net + " and keep the position open.";
  if (hits(c, "bridge")) return "Bridge $" + cap + " of USDC to " + net + " through " + nm + " and use the bridged funds in its app.";
  if (hits(c, "staking", "restak")) return "Stake $" + cap + " of the chain's staking asset through " + nm + " and keep the receipt.";
  if (hits(c, "perpetual", "derivative")) return "Deposit $" + cap + " of USDC as margin on " + nm + " and open one small hedge.";
  if (hits(c, "prediction")) return "Fund $" + cap + " and place one market position on " + nm + ".";
  if (hits(c, "stable")) return "Mint or deposit $" + cap + " of the stable asset through " + nm + " on " + net + ".";
  if (hits(c, "rwa")) return "Mint $" + cap + " of the protocol's yield asset on " + net + " and hold it.";
  if (hits(c, "insurance")) return "Buy $" + cap + " of cover from " + nm + " on " + net + " and keep the policy.";
  if (c === "chain") return "Bridge $" + cap + " of USDC to " + net + " and use an app on it.";
  if (hits(c, "payment")) return "Use " + nm + " on " + net + " for $" + cap + " of payments and keep the activity weekly.";
  return "Deposit $" + cap + " of USDC into " + nm + " on " + net + " and keep the position open.";
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a
 * time, built from the protocol's own record (category, chains, TVL, age).
 * Step two is a check before any money moves; step six is the claim-safety
 * rule: only the link the protocol itself publishes, never a payment to claim.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const net = firstChain(p);
  const cap = stakeSize(p);
  const hold = holdWindow(age);
  const action = actionFor(p, cap, net);
  const gas = cap >= 150 ? 8 : 4;
  return [
    { text: "Use a fresh wallet that holds only the funds you plan to farm," +
        " and keep its seed phrase offline.",
      cost: "under $3 of gas " + "for the first transaction", time: "5 minutes" },
    { text: "Open the protocol's own docs from its official domain " +
        "and check its audit and risk pages before you deposit anything.",
      cost: "nothing to check", time: "15 minutes" },
    { text: action,
      cost: "$" + cap + " of capital and about $" + gas + " of gas", time: "15 minutes " + "to set up" },
    { text: "Make one qualifying action each week, such as a deposit, " +
        "a borrow, a swap or a vote.",
      cost: "about $2 of gas " + "a week", time: "10 minutes " + "a week" },
    { text: "Hold the position for at least " + hold + " days so the activity " +
        "is counted in more than one snapshot.",
      cost: "the $" + cap + " stays in the position", time: String(hold) + " days" },
    { text: "Before you withdraw, open the protocol's own points or rewards page " +
        "and claim only from the link it publishes.",
      cost: "no fee to check, " + "and never pay to claim", time: "10 minutes" },
    { text: "Write the wallet, the dates and every transaction in a farm log " +
        "so you can repeat the position or unwind it.",
      cost: "nothing but the log", time: "5 minutes" },
  ];
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

/** A board row's compact form for the dashboard page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank, slug: row.slug, name: row.name, category: row.category,
    chains: row.chains, tvl_usd: row.tvl_usd, change_7d: row.change_7d,
    mcap_usd: row.mcap_usd, listed_at: row.listed_at, age_days: row.age_days,
    implied_value_usd: row.implied_value_usd, growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier, segment: row.segment,
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
  const radar: RadarData = {
    as_of: snapshot.as_of, source: snapshot.source, floor_usd: snapshot.floor_usd,
    model, model_version: MODEL_VERSION, watchlist_size: snapshot.watchlist.length,
    board_size: board.length, early_size: early, live_size: live.length,
    rows: board.map(radarRow), live, calibration: calibration(snapshot), stats: boardStats(board),
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

/** The dashboard's dataset as one script tag's worth of JavaScript. */
export function dataScript(radar: RadarData): string {
  return "window.RADAR=" + JSON.stringify(radar) + ";\n";
}
