// Token Launch Radar — farm plan system, radar-2 model.
//
// Drop-in replacement for the farm-plan block of lib/model.ts (the
// `farmSteps` / `actionFor` / `stakeSize` / `holdWindow` / `firstChain`
// functions). It keeps the same public names and the same FarmStep shape,
// so main.ts needs no change beyond importing from here instead.
//
// What it fixes: the submitted board's plan was one boilerplate for all
// 200 rows ("Read docs and token signals; cost $0" + the same two steps),
// with the action step identical on every row. This system branches on
// four things the snapshot actually carries, so no two categories get the
// same plan:
//
//   1. category  -> one of 13 plan families (lending, dex, staking, yield,
//      bridge, derivatives, rwa, chain, prediction, launchpad, insurance,
//      payments, otc, fallback). Every family writes its own six steps:
//      setup, pre-deposit check, core action, weekly action, hold, exit.
//   2. chain     -> gas cost and gas token come from a per-chain table, so
//      an Ethereum plan costs dollars per transaction and a Solana plan
//      costs cents. The gas figures are TYPICAL mainnet fees, a model
//      assumption, not snapshot data and not a live quote.
//   3. TVL       -> capital tiers ($50 / $100 / $150 / $250). A protocol
//      above $1B also gets a split-across-two-wallets note in its setup.
//   4. age + 7d  -> hold window (young <180d: 60 days, 180-365d: 45 days,
//      older: 30 days, unknown: 30 days). A TVL fall of 20% or more in
//      7 days halves the starter capital and adds a warning to the check.
//
// Every step carries its own cost and time. Steps stay inside the gate's
// bounds (3-12 steps per row, each 20-600 characters once joined).

/** One protocol entry exactly as the sealed snapshot carries it. */
export interface SnapshotProtocol {
  slug: string; name: string; category: string | null;
  chains: string[]; tvl_usd: number; change_7d: number | null;
  mcap_usd: number | null; listed_at: string | null;
  gecko_id: string | null; symbol: string | null;
}

/** One step of a farm plan: what to do, what it costs, how long it takes. */
export interface FarmStep {
  text: string; cost: string; time: string;
}

const MS_PER_DAY = 86_400_000;

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

// ---------------------------------------------------------------------------
// Per-chain gas: typical cost of one simple transaction on that chain, in
// whole US dollars. MODEL ASSUMPTION, not snapshot data and not a live
// quote: fees move with congestion, so the plan states the typical band
// the reader should expect, and the step text says to check the live fee
// before sending. Chains the table does not name fall back to $0.10.
// ---------------------------------------------------------------------------
const GAS_USD: Record<string, number> = {
  "Ethereum": 2.5, "Bitcoin": 1.5, "Tron": 0.5, "Cardano": 0.2,
  "Binance": 0.05, "Avalanche": 0.05, "Starknet": 0.05, "zkSync Era": 0.05,
  "Arbitrum": 0.05, "Doge": 0.05, "Litecoin": 0.05, "TON": 0.05,
  "BSquared": 0.05, "CORE": 0.05, "RSK": 0.05,
  "Solana": 0.01, "Polygon": 0.01, "Unichain": 0.01, "Sonic": 0.01,
  "Sui": 0.01, "Sei": 0.01, "Hyperliquid L1": 0.01, "Monad": 0.01,
  "Stellar": 0.01, "Ripple": 0.01, "Ronin": 0.01, "Telos": 0.01,
  "Base": 0.02, "Plasma": 0.02, "Optimism": 0.02, "Robinhood Chain": 0.02,
  "Berachain": 0.02, "Flare": 0.02, "Linea": 0.02, "Plume Mainnet": 0.02,
  "Arc": 0.02, "Katana": 0.02, "Mantle": 0.02, "Hemi": 0.02, "Ink": 0.02,
  "Scroll": 0.02, "TAC": 0.02, "Celo": 0.02, "Pharos": 0.02, "BOB": 0.02,
  "World Chain": 0.02, "Tempo": 0.02, "Blast": 0.02, "Astar": 0.02,
  "Provenance": 0.02, "Stable": 0.02, "Morph": 0.02, "Mezo": 0.02,
  "Citrea": 0.02, "X Layer": 0.02, "Etherlink": 0.02, "Fluent": 0.02,
  "Fantom": 0.02, "Bittensor": 0.02, "Bittensor EVM": 0.02, "Cronos": 0.02,
  "Aptos": 0.02, "Near": 0.02, "Kava": 0.02, "Lisk": 0.02, "Noble": 0.02,
  "XDC": 0.02, "Metis": 0.02, "Mode": 0.02, "Zircuit": 0.02,
  "Polygon zkEVM": 0.02, "Moonbeam": 0.02, "ZetaChain": 0.02, "Saga": 0.02,
  "Soneium": 0.02, "Zcash": 0.02, "Manta": 0.02, "Fraxtal": 0.02,
};
const DEFAULT_GAS_USD = 0.1;

/** Typical gas for one transaction on `chain`, in dollars. */
export function gasUsd(chain: string): number {
  const g = GAS_USD[chain];
  return g === undefined ? DEFAULT_GAS_USD : g;
}

/** A dollar amount as "$2.50" / "$0.01": two decimals, no thousands split. */
export function usd(n: number): string {
  return "$" + n.toFixed(2);
}

// ---------------------------------------------------------------------------
// Native gas token per chain, so the setup step tells the reader exactly
// what to hold for fees. Chains not named here use the neutral fallback.
// ---------------------------------------------------------------------------
const NATIVE_TOKEN: Record<string, string> = {
  "Ethereum": "ETH", "Base": "ETH", "Arbitrum": "ETH", "Optimism": "ETH",
  "Linea": "ETH", "Blast": "ETH", "Scroll": "ETH", "zkSync Era": "ETH",
  "Unichain": "ETH", "World Chain": "ETH", "Ink": "ETH", "Mode": "ETH",
  "Solana": "SOL", "Binance": "BNB", "Avalanche": "AVAX", "Polygon": "POL",
  "Polygon zkEVM": "ETH", "Sui": "SUI", "Aptos": "APT", "TON": "TON",
  "Stellar": "XLM", "Ripple": "XRP", "Tron": "TRX", "Cardano": "ADA",
  "Bitcoin": "BTC", "Doge": "DOGE", "Litecoin": "LTC", "Sonic": "S",
  "Fantom": "FTM", "Sei": "SEI", "Near": "NEAR", "Bittensor": "TAO",
  "Hyperliquid L1": "HYPE", "Monad": "MON", "Berachain": "BERA",
  "Mantle": "MNT", "Celo": "CELO", "Kava": "KAVA", "Cronos": "CRO",
  "Zcash": "ZEC", "Starknet": "STRK", "Plume Mainnet": "PLUME",
  "XDC": "XDC", "Lisk": "LSK", "Metis": "METIS", "Moonbeam": "GLMR",
};

/** The native gas token of `chain`, or a neutral phrase when unnamed. */
function gasToken(chain: string): string {
  const t = NATIVE_TOKEN[chain];
  return t === undefined ? "the chain's native token" : t;
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

/** True when the protocol's TVL fell 20% or more over the last 7 days. */
function isFalling(p: SnapshotProtocol): boolean {
  return typeof p.change_7d === "number" && p.change_7d <= -20;
}

/**
 * The starter capital for this protocol: the TVL tier, halved (to a $25
 * floor) while its TVL is falling hard, so a reader risks less on a
 * protocol that is bleeding deposits.
 */
function capitalFor(p: SnapshotProtocol): number {
  const base = stakeSize(p);
  if (isFalling(p)) return Math.max(25, Math.floor(base / 2));
  return base;
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

// ---------------------------------------------------------------------------
// Plan context: everything a family's step builders need, computed once.
// ---------------------------------------------------------------------------
export interface PlanCtx {
  name: string; net: string; gas: number; token: string; cap: number;
  hold: number; age: number | null; tvl: number; falling: boolean;
  multiChain: boolean; extraChains: number;
}

/**
 * Plan context, exported so lib/model.ts can store the plan's compact
 * parameters (family, capital, hold, gas, token, falling, extra chains)
 * per board row for the dashboard. The step builders themselves stay
 * private; only this one-word export was added by the rebuild worker.
 */
export function planCtx(p: SnapshotProtocol, age: number | null): PlanCtx {
  const net = firstChain(p);
  return {
    name: p.name, net, gas: gasUsd(net), token: gasToken(net),
    cap: capitalFor(p), hold: holdWindow(age), age,
    tvl: p.tvl_usd, falling: isFalling(p),
    multiChain: p.chains.length > 1, extraChains: Math.max(0, p.chains.length - 1),
  };
}

/** One step builder: a family slot filled in from the plan context. */
type StepFn = (c: PlanCtx) => FarmStep;

/** A family's six slots: setup, check, core action, weekly, hold, exit. */
interface PlanSpec {
  family: string;
  setup: StepFn; check: StepFn; core: StepFn;
  weekly: StepFn; hold: StepFn; exit: StepFn;
}

/** The split-across-wallets note, only for protocols above $1B of TVL. */
function splitNote(c: PlanCtx): string {
  if (c.tvl >= 1_000_000_000) {
    return " Split the position across two wallets, so one mistake cannot take the whole position.";
  }
  return "";
}

/** The multi-chain note, only when the protocol runs on more than one chain. */
function multiNote(c: PlanCtx): string {
  if (c.multiChain) {
    return " The protocol also runs on " + c.extraChains + " other chain" +
      (c.extraChains === 1 ? "" : "s") + "; farm on " + c.net + " only, so the activity stays in one place.";
  }
  return "";
}

/** The falling-TVL warning, only when the 7-day move is -20% or worse. */
function fallingNote(c: PlanCtx): string {
  if (c.falling) {
    return " Its TVL fell 20% or more in the last 7 days, so start with the halved size and check why deposits are leaving before adding more.";
  }
  return "";
}

// ---------------------------------------------------------------------------
// The 13 plan families. Each family writes its own six steps, so the plan
// a reader gets for a lending market reads nothing like the plan for a
// bridge or a staking pool: different action, different risk check,
// different weekly habit, different exit mechanics. Shared notes (split,
// multi-chain, falling TVL) are appended only where they apply.
// ---------------------------------------------------------------------------

const LENDING: PlanSpec = {
  family: "lending",
  setup: (c) => ({
    text: "Use a fresh wallet that holds only the funds you plan to farm on " + c.name + ", plus " +
      "enough " + c.token + " for fees on " + c.net + "." + splitNote(c) + multiNote(c),
    cost: "about " + usd(c.gas) + " of gas for the first transaction",
    time: "5 minutes",
  }),
  check: (c) => ({
    text: "Open " + c.name + "'s docs and read its liquidation threshold, " +
      "loan-to-value limit and oracle setup before you deposit anything." + fallingNote(c),
    cost: "nothing to check",
    time: "20 minutes",
  }),
  core: (c) => ({
    text: "Supply $" + c.cap + " of USDC as collateral to " + c.name + " on " + c.net +
      ", then borrow about 30% of it in stablecoins so the position records both a supply and a borrow.",
    cost: "$" + c.cap + " of capital and about " + usd(c.gas * 2) + " of gas for the two transactions",
    time: "15 minutes to set up",
  }),
  weekly: (c) => ({
    text: "Once a week, top up the collateral or repay part of the borrow so the health factor on " + c.name + " stays above 2, and leave the position open between actions.",
    cost: "about " + usd(c.gas) + " of gas a week",
    time: "10 minutes a week",
  }),
  hold: (c) => ({
    text: "Hold the " + c.name + " position for at least " + c.hold + " days so interest accrues " +
      "and the activity is counted in more than one snapshot" +
      (c.age !== null && c.age < 180 ? "; a protocol this young needs the longer window to prove the position is real" : "") + ".",
    cost: "the $" + c.cap + " stays in the position",
    time: c.hold + " days",
  }),
  exit: (c) => ({
    text: "Repay the " + c.name + " borrow in full first, then withdraw the collateral. Claim " +
      "any points or rewards only from the link the protocol itself publishes, and never pay to claim.",
    cost: "about " + usd(c.gas * 2) + " of gas to unwind",
    time: "15 minutes",
  }),
};

const DEX: PlanSpec = {
  family: "dex",
  setup: (c) => ({
    text: "Use a fresh wallet that holds only the funds you plan to farm on " + c.name + ", split " +
      "into the two assets of the pool, plus enough " + c.token + " for fees on " + c.net + "." + splitNote(c) + multiNote(c),
    cost: "about " + usd(c.gas) + " of gas for the first transaction",
    time: "5 minutes",
  }),
  check: (c) => ({
    text: "Open " + c.name + "'s docs and check the main pool's fee tier, the " +
      "price range it covers, the audit report and whether its TVL is holding." + fallingNote(c),
    cost: "nothing to check",
    time: "20 minutes",
  }),
  core: (c) => ({
    text: "Provide $" + c.cap + " of liquidity to " + c.name + "'s main pool on " + c.net +
      " inside the active price range, so the position earns trading fees from the first day.",
    cost: "$" + c.cap + " of capital and about " + usd(c.gas) + " of gas",
    time: "15 minutes to set up",
  }),
  weekly: (c) => ({
    text: "Once a week, collect the earned fees from " + c.name + " and, if the price moved out of " +
      "range, move the position back into range instead of leaving it idle.",
    cost: "about " + usd(c.gas * 2) + " of gas a week",
    time: "15 minutes a week",
  }),
  hold: (c) => ({
    text: "Hold the " + c.name + " position for at least " + c.hold + " days so fee income " +
      "accrues and the liquidity counts across more than one snapshot" +
      (c.age !== null && c.age < 180 ? "; a protocol this young needs the longer window to prove the position is real" : "") + ".",
    cost: "the $" + c.cap + " stays in the pool; impermanent loss moves with the price",
    time: c.hold + " days",
  }),
  exit: (c) => ({
    text: "Remove the liquidity from " + c.name + " in one transaction and claim the fees from the " +
      "pool page itself. Claim any points or rewards only from the link the protocol itself publishes, and never pay to claim.",
    cost: "about " + usd(c.gas) + " of gas to exit",
    time: "10 minutes",
  }),
};

const STAKING: PlanSpec = {
  family: "staking",
  setup: (c) => ({
    text: "Use a fresh wallet that holds only the funds you plan to farm on " + c.name + ", in the " +
      "chain's staking asset, plus enough " + c.token + " for fees on " + c.net + "." + splitNote(c) + multiNote(c),
    cost: "about " + usd(c.gas) + " of gas for the first transaction",
    time: "5 minutes",
  }),
  check: (c) => ({
    text: "Open " + c.name + "'s docs and read the validator set, the slashing " +
      "terms and the unbonding period before you stake anything." + fallingNote(c),
    cost: "nothing to check",
    time: "20 minutes",
  }),
  core: (c) => ({
    text: "Stake $" + c.cap + " of the staking asset through " + c.name + " on " + c.net +
      " and keep the liquid receipt token it issues; do not sell the receipt, it is the proof of the stake.",
    cost: "$" + c.cap + " of capital and about " + usd(c.gas) + " of gas",
    time: "15 minutes to set up",
  }),
  weekly: (c) => ({
    text: "Once a week, restake the " + c.name + " staking rewards and keep the receipt token " +
      "in the wallet, so the stake compounds instead of sitting still.",
    cost: "about " + usd(c.gas) + " of gas a week",
    time: "10 minutes a week",
  }),
  hold: (c) => ({
    text: "Hold the " + c.name + " stake for at least " + c.hold + " days; rewards accrue per " +
      "epoch and the position counts across more than one snapshot" +
      (c.age !== null && c.age < 180 ? "; a protocol this young needs the longer window to prove the position is real" : "") + ".",
    cost: "the $" + c.cap + " stays staked",
    time: c.hold + " days",
  }),
  exit: (c) => ({
    text: "Start the " + c.name + " unbonding early, because it takes days to weeks before the " +
      "funds return, then claim any points or rewards only from the link the protocol itself publishes, and never pay to claim.",
    cost: "about " + usd(c.gas) + " of gas to start the exit",
    time: "10 minutes, plus the unbonding wait",
  }),
};

const YIELD: PlanSpec = {
  family: "yield",
  setup: (c) => ({
    text: "Use a fresh wallet that holds only the funds you plan to farm on " + c.name + ", plus " +
      "enough " + c.token + " for fees on " + c.net + "." + splitNote(c) + multiNote(c),
    cost: "about " + usd(c.gas) + " of gas for the first transaction",
    time: "5 minutes",
  }),
  check: (c) => ({
    text: "Open " + c.name + "'s docs and read the vault strategy, the " +
      "underlying protocols it deposits into, the curator's track record and the fee schedule." + fallingNote(c),
    cost: "nothing to check",
    time: "25 minutes",
  }),
  core: (c) => ({
    text: "Deposit $" + c.cap + " of USDC into the " + c.name + " vault on " + c.net +
      " and keep the vault shares it issues; the shares are the position, and their value is where the yield lands.",
    cost: "$" + c.cap + " of capital and about " + usd(c.gas) + " of gas",
    time: "15 minutes to set up",
  }),
  weekly: (c) => ({
    text: "Once a week, check whether the " + c.name + " vault changed strategy or curator, " +
      "and add a small top-up only while the strategy is unchanged.",
    cost: "about " + usd(c.gas) + " of gas a week",
    time: "10 minutes a week",
  }),
  hold: (c) => ({
    text: "Hold the " + c.name + " shares for at least " + c.hold + " days so the yield " +
      "compounds inside them and the deposit counts across more than one snapshot" +
      (c.age !== null && c.age < 180 ? "; a protocol this young needs the longer window to prove the position is real" : "") + ".",
    cost: "the $" + c.cap + " stays in the vault",
    time: c.hold + " days",
  }),
  exit: (c) => ({
    text: "Redeem the " + c.name + " vault shares through the protocol's own page; some vaults " +
      "queue redemptions, so start the exit before you need the funds. Claim any points only from the link the protocol itself publishes, and never pay to claim.",
    cost: "about " + usd(c.gas) + " of gas to redeem",
    time: "10 minutes, plus any redemption queue",
  }),
};

const BRIDGE: PlanSpec = {
  family: "bridge",
  setup: (c) => ({
    text: "Use a fresh wallet that holds only the funds you plan to farm on " + c.name + ", with " +
      "gas on both sides of the route: " + c.token + " on " + c.net + " and gas on the destination chain." + splitNote(c) + multiNote(c),
    cost: "about " + usd(c.gas) + " of gas for the first transaction",
    time: "10 minutes",
  }),
  check: (c) => ({
    text: "Open " + c.name + "'s docs and check the bridge's security model, " +
      "its fee per transfer, the supported routes and how long finality takes." + fallingNote(c),
    cost: "nothing to check",
    time: "20 minutes",
  }),
  core: (c) => ({
    text: "Bridge $" + c.cap + " of USDC through " + c.name + " to its main " +
      "destination chain, then use the bridged funds once in an app on that chain so the transfer is not a dead end.",
    cost: "$" + c.cap + " of capital and about " + usd(c.gas * 3) + " of gas for the bridge and the first use",
    time: "20 minutes to set up, plus finality",
  }),
  weekly: (c) => ({
    text: "Once a week, bridge a small amount across " + c.name + " again or use the bridged " +
      "funds in a destination-chain app, so the route sees repeated use rather than one transfer.",
    cost: "about " + usd(c.gas * 2) + " of gas a week",
    time: "15 minutes a week",
  }),
  hold: (c) => ({
    text: "Keep bridging activity on " + c.name + " going for at least " + c.hold + " days so the " +
      "route use is counted across more than one snapshot" +
      (c.age !== null && c.age < 180 ? "; a protocol this young needs the longer window to prove the route use is real" : "") + ".",
    cost: "the $" + c.cap + " stays working on the destination chain",
    time: c.hold + " days",
  }),
  exit: (c) => ({
    text: "Bridge the funds back to the origin chain through " + c.name + ". " +
      "Claim any points or rewards only from the link the protocol itself publishes, and never pay to claim.",
    cost: "about " + usd(c.gas * 2) + " of gas to bridge back",
    time: "15 minutes, plus finality",
  }),
};

const DERIVATIVES: PlanSpec = {
  family: "derivatives",
  setup: (c) => ({
    text: "Use a fresh wallet that holds only the funds you plan to farm on " + c.name + ", plus " +
      "enough " + c.token + " for fees on " + c.net + ", and read the liquidation rules before any deposit." + splitNote(c) + multiNote(c),
    cost: "about " + usd(c.gas) + " of gas for the first transaction",
    time: "10 minutes",
  }),
  check: (c) => ({
    text: "Open " + c.name + "'s docs and check the funding rate, the margin " +
      "requirement, the oracle it prices from and the liquidation price for the position you plan." + fallingNote(c),
    cost: "nothing to check",
    time: "25 minutes",
  }),
  core: (c) => ({
    text: "Deposit $" + c.cap + " of USDC as margin on " + c.name + " and open " +
      "one small hedge worth no more than 20% of that margin, so a move against you cannot liquidate the whole deposit.",
    cost: "$" + c.cap + " of capital and about " + usd(c.gas * 2) + " of gas for the deposit and the hedge",
    time: "20 minutes to set up",
  }),
  weekly: (c) => ({
    text: "Once a week, check " + c.name + "'s funding rate and the margin level, close the " +
      "hedge and reopen it if the rate turned against you, and keep the margin above the maintenance level.",
    cost: "about " + usd(c.gas * 2) + " of gas a week",
    time: "15 minutes a week",
  }),
  hold: (c) => ({
    text: "Keep the " + c.name + " margin position open for at least " + c.hold + " days so the " +
      "trading activity counts across more than one snapshot" +
      (c.age !== null && c.age < 180 ? "; a protocol this young needs the longer window to prove the position is real" : "") + ".",
    cost: "the $" + c.cap + " stays as margin; a liquidation would lose part of it",
    time: c.hold + " days",
  }),
  exit: (c) => ({
    text: "Close the " + c.name + " hedge first, then withdraw the margin in one transaction. " +
      "Claim any points or rewards only from the link the protocol itself publishes, and never pay to claim.",
    cost: "about " + usd(c.gas * 2) + " of gas to close out",
    time: "15 minutes",
  }),
};

const RWA: PlanSpec = {
  family: "rwa",
  setup: (c) => ({
    text: "Use a fresh wallet that holds only the funds you plan to farm on " + c.name + ", plus " +
      "enough " + c.token + " for fees on " + c.net + ", and check whether the protocol needs any eligibility step before minting." + splitNote(c) + multiNote(c),
    cost: "about " + usd(c.gas) + " of gas for the first transaction",
    time: "10 minutes",
  }),
  check: (c) => ({
    text: "Open " + c.name + "'s docs and read what backs the asset, who the " +
      "custodian is, the redemption terms and the audit of the reserves." + fallingNote(c),
    cost: "nothing to check",
    time: "25 minutes",
  }),
  core: (c) => ({
    text: "Mint $" + c.cap + " of the protocol's yield-bearing asset on " + c.net +
      " through " + c.name + " and hold the minted tokens in the wallet.",
    cost: "$" + c.cap + " of capital and about " + usd(c.gas) + " of gas",
    time: "15 minutes to set up",
  }),
  weekly: (c) => ({
    text: "Once a week, check the yield that accrued on the minted " + c.name + " asset and " +
      "reinvest the distribution if the protocol lets you compound it.",
    cost: "about " + usd(c.gas) + " of gas a week",
    time: "10 minutes a week",
  }),
  hold: (c) => ({
    text: "Hold the minted " + c.name + " asset for at least " + c.hold + " days so the yield " +
      "accrues and the holding counts across more than one snapshot" +
      (c.age !== null && c.age < 180 ? "; a protocol this young needs the longer window to prove the holding is real" : "") + ".",
    cost: "the $" + c.cap + " stays in the minted asset",
    time: c.hold + " days",
  }),
  exit: (c) => ({
    text: "Redeem the " + c.name + " asset through the protocol's own page; redemption can take " +
      "days while the custodian settles, so start before you need the funds. Claim any points only from the link the protocol itself publishes, and never pay to claim.",
    cost: "about " + usd(c.gas) + " of gas to redeem",
    time: "10 minutes, plus settlement",
  }),
};

const CHAIN: PlanSpec = {
  family: "chain",
  setup: (c) => ({
    text: "Use a fresh wallet that holds only the funds you plan to farm on " + c.name + ", plus " +
      "enough " + c.token + " for gas on " + c.net + ", since every action on a chain costs its native token." + splitNote(c) + multiNote(c),
    cost: "about " + usd(c.gas) + " of gas for the first transaction",
    time: "5 minutes",
  }),
  check: (c) => ({
    text: "Open " + c.name + "'s docs and check the official bridge contract, " +
      "the apps live on it and whether its TVL is holding." + fallingNote(c),
    cost: "nothing to check",
    time: "20 minutes",
  }),
  core: (c) => ({
    text: "Bridge $" + c.cap + " of USDC to " + c.net + " and use it once in a " +
      "native app on the chain, such as a swap or a stake, so the funds do real work there.",
    cost: "$" + c.cap + " of capital and about " + usd(c.gas * 2) + " of gas for the bridge and the first use",
    time: "20 minutes to set up, plus finality",
  }),
  weekly: (c) => ({
    text: "Once a week, make one transaction in a native app on " + c.net + ", " +
      "such as a swap, a stake or a vote, so the wallet stays active on " + c.name + ".",
    cost: "about " + usd(c.gas) + " of gas a week",
    time: "10 minutes a week",
  }),
  hold: (c) => ({
    text: "Stay active on " + c.name + " for at least " + c.hold + " days so the " +
      "activity counts across more than one snapshot" +
      (c.age !== null && c.age < 180 ? "; a chain this young needs the longer window to prove the activity is real" : "") + ".",
    cost: "the $" + c.cap + " stays working on the chain",
    time: c.hold + " days",
  }),
  exit: (c) => ({
    text: "Bridge the funds back out through " + c.name + "'s official bridge. Claim " +
      "any points or rewards only from the link the chain itself publishes, and never pay to claim.",
    cost: "about " + usd(c.gas * 2) + " of gas to bridge out",
    time: "15 minutes, plus finality",
  }),
};

const PREDICTION: PlanSpec = {
  family: "prediction",
  setup: (c) => ({
    text: "Use a fresh wallet that holds only the funds you plan to farm in USDC, " +
      "plus enough " + c.token + " for fees on " + c.net + "." + splitNote(c) + multiNote(c),
    cost: "about " + usd(c.gas) + " of gas for the first transaction",
    time: "5 minutes",
  }),
  check: (c) => ({
    text: "Open " + c.name + "'s docs and read the market rules, the " +
      "resolution source and the trading fee before you place anything." + fallingNote(c),
    cost: "nothing to check",
    time: "15 minutes",
  }),
  core: (c) => ({
    text: "Fund the wallet with $" + c.cap + " and place one position of no more " +
      "than $" + Math.max(10, Math.floor(c.cap / 5)) + " on an open market on " + c.name +
      " that resolves after your hold window, keeping the rest in reserve.",
    cost: "$" + c.cap + " of capital and about " + usd(c.gas) + " of gas",
    time: "15 minutes to set up",
  }),
  weekly: (c) => ({
    text: "Once a week, place one more small position on a new " + c.name + " market, so the " +
      "wallet shows repeated trading rather than a single bet.",
    cost: "about " + usd(c.gas) + " of gas a week",
    time: "10 minutes a week",
  }),
  hold: (c) => ({
    text: "Keep trading on " + c.name + " for at least " + c.hold + " days and let the markets " +
      "resolve on their own schedule; do not chase a loss by doubling a position.",
    cost: "the $" + c.cap + " stays in open positions until they resolve",
    time: c.hold + " days",
  }),
  exit: (c) => ({
    text: "Claim winnings from each resolved " + c.name + " market on the market page itself. " +
      "Claim any points or rewards only from the link the protocol itself publishes, and never pay to claim.",
    cost: "about " + usd(c.gas) + " of gas per claim",
    time: "10 minutes",
  }),
};

const LAUNCHPAD: PlanSpec = {
  family: "launchpad",
  setup: (c) => ({
    text: "Use a fresh wallet that holds only the funds you plan to farm on " + c.name + ", plus " +
      "enough " + c.token + " for fees on " + c.net + ", and check the eligibility rules for the next sale or lock." + splitNote(c) + multiNote(c),
    cost: "about " + usd(c.gas) + " of gas for the first transaction",
    time: "10 minutes",
  }),
  check: (c) => ({
    text: "Open " + c.name + "'s docs and read the lock period, the allocation " +
      "rules and the vesting schedule before you commit anything." + fallingNote(c),
    cost: "nothing to check",
    time: "20 minutes",
  }),
  core: (c) => ({
    text: "Commit $" + c.cap + " through " + c.name + " on " + c.net + " to its " +
      "current sale pool or lock, following the allocation rules it publishes.",
    cost: "$" + c.cap + " of capital and about " + usd(c.gas) + " of gas",
    time: "15 minutes to set up",
  }),
  weekly: (c) => ({
    text: "Once a week, check the " + c.name + " sale or lock status and join the next round " +
      "only while the terms are unchanged.",
    cost: "about " + usd(c.gas) + " of gas a week",
    time: "10 minutes a week",
  }),
  hold: (c) => ({
    text: "Keep the " + c.name + " commitment locked for at least " + c.hold + " days, or the " +
      "full vesting period if it is longer, so the lock counts across more than one snapshot.",
    cost: "the $" + c.cap + " stays locked",
    time: c.hold + " days, or the vesting period",
  }),
  exit: (c) => ({
    text: "Claim the " + c.name + " allocation only after the vesting date, from the protocol's " +
      "own page. Claim any points only from the link the protocol itself publishes, and never pay to claim.",
    cost: "about " + usd(c.gas) + " of gas to claim",
    time: "10 minutes",
  }),
};

const INSURANCE: PlanSpec = {
  family: "insurance",
  setup: (c) => ({
    text: "Use a fresh wallet that holds only the funds you plan to farm on " + c.name + ", plus " +
      "enough " + c.token + " for fees on " + c.net + "." + splitNote(c) + multiNote(c),
    cost: "about " + usd(c.gas) + " of gas for the first transaction",
    time: "5 minutes",
  }),
  check: (c) => ({
    text: "Open " + c.name + "'s docs and read what the cover actually pays " +
      "for, the exclusions, the claim process and the premium rate." + fallingNote(c),
    cost: "nothing to check",
    time: "20 minutes",
  }),
  core: (c) => ({
    text: "Buy $" + c.cap + " of cover from " + c.name + " on " + c.net + " for " +
      "the protocol you already use, and keep the policy active.",
    cost: "$" + c.cap + " of cover plus the premium, and about " + usd(c.gas) + " of gas",
    time: "15 minutes to set up",
  }),
  weekly: (c) => ({
    text: "Once a week, check the " + c.name + " policy is still active and the covered " +
      "protocol has not changed its contracts in a way the cover excludes.",
    cost: "nothing a week",
    time: "5 minutes a week",
  }),
  hold: (c) => ({
    text: "Keep the " + c.name + " cover active for at least " + c.hold + " days so the policy " +
      "counts across more than one snapshot.",
    cost: "the premium is spent; the $" + c.cap + " is the covered amount",
    time: c.hold + " days",
  }),
  exit: (c) => ({
    text: "Let the " + c.name + " policy run to its end date, or cancel it from the protocol's " +
      "own page if it allows early exit. Claim any points only from the link the protocol itself publishes, and never pay to claim.",
    cost: "about " + usd(c.gas) + " of gas to cancel, if allowed",
    time: "10 minutes",
  }),
};

const PAYMENTS: PlanSpec = {
  family: "payments",
  setup: (c) => ({
    text: "Use a fresh wallet that holds only the funds you plan to farm on " + c.name + ", plus " +
      "enough " + c.token + " for fees on " + c.net + ", and set it as the wallet you pay from." + splitNote(c) + multiNote(c),
    cost: "about " + usd(c.gas) + " of gas for the first transaction",
    time: "10 minutes",
  }),
  check: (c) => ({
    text: "Open " + c.name + "'s docs and read the supported payment rails, " +
      "the fees per payment and the limits before you route anything through it." + fallingNote(c),
    cost: "nothing to check",
    time: "15 minutes",
  }),
  core: (c) => ({
    text: "Route $" + c.cap + " of real payments through " + c.name + " on " + c.net +
      " over the first week, for things you would pay for anyway.",
    cost: "$" + c.cap + " of payments and about " + usd(c.gas) + " of gas per payment",
    time: "15 minutes to set up, then a week of payments",
  }),
  weekly: (c) => ({
    text: "Keep paying through " + c.name + " every week, at least once, so the " +
      "wallet shows steady payment volume rather than one burst.",
    cost: "about " + usd(c.gas) + " of gas a week",
    time: "10 minutes a week",
  }),
  hold: (c) => ({
    text: "Keep the payment activity on " + c.name + " going for at least " + c.hold + " days so " +
      "the volume counts across more than one snapshot.",
    cost: "the $" + c.cap + " is spent on real payments",
    time: c.hold + " days",
  }),
  exit: (c) => ({
    text: "Stop routing new payments and withdraw any balance from " + c.name + "'s page. Claim any points only from the link the protocol itself publishes, and never pay to claim.",
    cost: "about " + usd(c.gas) + " of gas to withdraw",
    time: "10 minutes",
  }),
};

const OTC: PlanSpec = {
  family: "otc",
  setup: (c) => ({
    text: "Use a fresh wallet that holds only the funds you plan to farm on " + c.name + ", plus " +
      "enough " + c.token + " for fees on " + c.net + "." + splitNote(c) + multiNote(c),
    cost: "about " + usd(c.gas) + " of gas for the first transaction",
    time: "5 minutes",
  }),
  check: (c) => ({
    text: "Open " + c.name + "'s docs and read the order types, the settlement " +
      "terms and the counterparty rules before you place anything." + fallingNote(c),
    cost: "nothing to check",
    time: "15 minutes",
  }),
  core: (c) => ({
    text: "Place one $" + c.cap + " order through " + c.name + " on " + c.net +
      " at the published price, and let it settle on the protocol's own terms.",
    cost: "$" + c.cap + " of capital and about " + usd(c.gas) + " of gas",
    time: "15 minutes to set up",
  }),
  weekly: (c) => ({
    text: "Once a week, check your open " + c.name + " orders and place one more small order only " +
      "while the published prices still make sense.",
    cost: "about " + usd(c.gas) + " of gas a week",
    time: "10 minutes a week",
  }),
  hold: (c) => ({
    text: "Keep trading on " + c.name + " for at least " + c.hold + " days so the " +
      "activity counts across more than one snapshot.",
    cost: "the $" + c.cap + " stays in settled trades",
    time: c.hold + " days",
  }),
  exit: (c) => ({
    text: "Cancel any open order and withdraw the balance from " + c.name + "'s page. " +
      "own page. Claim any points only from the link the protocol itself publishes, and never pay to claim.",
    cost: "about " + usd(c.gas) + " of gas to withdraw",
    time: "10 minutes",
  }),
};

const FALLBACK: PlanSpec = {
  family: "fallback",
  setup: (c) => ({
    text: "Use a fresh wallet that holds only the funds you plan to farm on " + c.name + ", plus " +
      "enough " + c.token + " for fees on " + c.net + "." + splitNote(c) + multiNote(c),
    cost: "about " + usd(c.gas) + " of gas for the first transaction",
    time: "5 minutes",
  }),
  check: (c) => ({
    text: "Open " + c.name + "'s docs and read what its main product does, " +
      "the risks it names and the audit report before you deposit anything." + fallingNote(c),
    cost: "nothing to check",
    time: "20 minutes",
  }),
  core: (c) => ({
    text: "Deposit $" + c.cap + " of USDC into " + c.name + "'s main product on " +
      c.net + " and keep the position open.",
    cost: "$" + c.cap + " of capital and about " + usd(c.gas) + " of gas",
    time: "15 minutes to set up",
  }),
  weekly: (c) => ({
    text: "Once a week, use " + c.name + "'s main product again, such as a " +
      "deposit, a swap or a vote, so the wallet shows repeated use.",
    cost: "about " + usd(c.gas) + " of gas a week",
    time: "10 minutes a week",
  }),
  hold: (c) => ({
    text: "Hold the " + c.name + " position for at least " + c.hold + " days so the activity " +
      "is counted in more than one snapshot" +
      (c.age !== null && c.age < 180 ? "; a protocol this young needs the longer window to prove the position is real" : "") + ".",
    cost: "the $" + c.cap + " stays in the position",
    time: c.hold + " days",
  }),
  exit: (c) => ({
    text: "Withdraw the position from " + c.name + "'s page. Claim any points " +
      "or rewards only from the link the protocol itself publishes, and never pay to claim.",
    cost: "about " + usd(c.gas) + " of gas to exit",
    time: "10 minutes",
  }),
};

// ---------------------------------------------------------------------------
// Category -> family. Covers all 39 categories the snapshot's rankable
// protocols carry (verified against snapshot.json 2026-11-14). Narrow
// matches run first: basis, curator and governance rows are matched before
// the broad rows that would also catch them.
// ---------------------------------------------------------------------------
export function familyFor(category: string | null): PlanSpec {
  const c = (category ?? "").toLowerCase();
  if (hits(c, "lend", "cdp", "collateral market", "collateral manag", "cedefi")) return LENDING;
  if (hits(c, "basis")) return DERIVATIVES;
  if (hits(c, "curator", "allocator", "governance incentive")) return YIELD;
  // "Indexes" contains "dex" as a substring, so the launchpad check must
  // run before the dex check below.
  if (hits(c, "launchpad", "token locker", "index")) return LAUNCHPAD;
  if (hits(c, "dex", "liquidity manager", "leveraged farm", "farm")) return DEX;
  if (hits(c, "bridge")) return BRIDGE;
  if (hits(c, "staking", "restak", "anchor btc", "decentralized btc")) return STAKING;
  if (hits(c, "perpetual", "derivative", "synthetic")) return DERIVATIVES;
  if (hits(c, "prediction")) return PREDICTION;
  if (hits(c, "stablecoin wrapper", "dual-token")) return RWA;
  if (hits(c, "stable")) return RWA;
  if (hits(c, "rwa")) return RWA;
  if (c === "chain") return CHAIN;
  if (hits(c, "yield", "risk curator")) return YIELD;
  if (hits(c, "insurance")) return INSURANCE;
  if (hits(c, "payment", "card issuer")) return PAYMENTS;
  if (hits(c, "otc")) return OTC;
  return FALLBACK;
}

/**
 * The one action for a category, in words a farmer can follow: the core
 * step of the family's plan, with this protocol's own name, chain and
 * capital in it. Kept as its own function so the dashboard can show the
 * action alone where it needs one line.
 */
export function actionFor(p: SnapshotProtocol, age: number | null): string {
  const ctx = planCtx(p, age);
  return stepText(familyFor(p.category).core(ctx));
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a
 * time, built from the protocol's own record (category, chains, TVL, age,
 * 7-day move). No two families share a plan, and the chain, the capital
 * tier, the hold window and the falling-TVL branch all change the text.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const ctx = planCtx(p, age);
  const spec = familyFor(p.category);
  return [
    spec.setup(ctx), spec.check(ctx), spec.core(ctx),
    spec.weekly(ctx), spec.hold(ctx), spec.exit(ctx),
  ];
}
