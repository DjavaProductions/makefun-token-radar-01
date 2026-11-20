import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { buildDossier } from './vendor/makefun-board.ts';

function arg(n: string, d: string) {
 const i = process.argv.indexOf('--' + n);
 return i >= 0 ? process.argv[i + 1] : d;
}

const input = arg('input', '/input');
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR || '/output');
const snapshotPath = input.endsWith('.json') ? input : join(input, 'snapshot.json');
const snap = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const protocols = snap.protocols;
const token = protocols.filter((p: any) => p.mcap_usd != null);
const ratios = token
 .map((p: any) => p.mcap_usd / p.tvl_usd)
 .sort((a: number, b: number) => a - b);
const base = ratios[Math.floor(ratios.length / 2)];
const watch = new Set(snap.watchlist);
const eligible = protocols.filter(
 (p: any) => p.mcap_usd == null && p.gecko_id == null && p.symbol == null
);

function age(p: any) {
 const t = Date.parse(p.listed_at || snap.as_of + 'T00:00:00Z');
 const snapshotTime = Date.parse(snap.as_of + 'T00:00:00Z');
 return Math.max(0, (snapshotTime - t) / 86400000);
}

function score(p: any) {
 const growth = Math.max(
  .55,
  Math.min(1.8, 1 + (p.change_7d || 0) / 100)
 );
 const af = .72 + .28 * Math.exp(-age(p) / 900);
 return Math.max(1, Math.round(p.tvl_usd * base * growth * af));
}

const rows = eligible
 .map((p: any) => ({
  ...p,
  implied_value_usd: score(p),
  _watch: watch.has(p.slug)
 }))
 .sort(
  (a: any, b: any) =>
   b._watch - a._watch ||
   b.implied_value_usd - a.implied_value_usd ||
   b.tvl_usd - a.tvl_usd ||
   a.slug.localeCompare(b.slug)
 );
const chosen = [
 ...rows.filter((p: any) => p._watch),
 ...rows.filter((p: any) => !p._watch).sort((a: any, b: any) => b.tvl_usd - a.tvl_usd)
]
 .slice(0, 200)
 .sort(
  (a: any, b: any) =>
   b.implied_value_usd - a.implied_value_usd ||
   b.tvl_usd - a.tvl_usd ||
   a.slug.localeCompare(b.slug)
 );

function steps(p: any) {
 const ch = (p.chains || []).slice(0, 3).join(', ') || 'supported chains';
 return [
  `Read ${p.name} docs and token signals; cost $0, 45 minutes.`,
  `Monitor ${ch} announcements for 7 days; cost $0, 2 hours total.`,
  `Test core flows with a fresh wallet; budget $15 gas, 90 minutes.`
 ];
}

const board = chosen.map((p: any, i: number) => ({
 slug: p.slug,
 name: p.name,
 rank: i + 1,
 implied_value_usd: p.implied_value_usd,
 farm_steps: steps(p)
}));
mkdirSync(out, { recursive: true });
mkdirSync(join(out, 'dashboard'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
writeFileSync(join(out, 'board.json'), JSON.stringify({ rows: board }) + '\n');
const data = board.map((r: any) => {
 const p = chosen.find((q: any) => q.slug === r.slug);
 return [
  r.slug,
  r.name,
  r.rank,
  r.implied_value_usd,
  p?.tvl_usd || 0,
  p?.category || 'Other',
  (p?.chains || []).slice(0, 3),
  r.farm_steps
 ];
});
const dataSource = 'window.RADAR=[' + data.map((r: any) => JSON.stringify(r)).join(',\n') + '];';
writeFileSync(join(out, 'data.js'), dataSource);
for (const f of ['index.html', 'app.css', 'app.js']) {
 copyFileSync(join('dashboard', f), join(out, 'dashboard', f));
}
writeFileSync(join(out, 'dashboard', 'data.js'), dataSource);
for (const f of ['1-board.png', '2-detail.png', '3-filtered.png']) {
 if (existsSync(join('screenshots', f))) {
  copyFileSync(join('screenshots', f), join(out, 'screenshots', f));
 }
}
writeFileSync(
 join(out, 'dossier.json'),
 buildDossier(out, {
  text_max_bytes: 65536,
  screenshots: { max: 4, max_bytes: 524288 },
  dashboard: { max_files: 400, max_bytes: 4194304 }
 })
);
console.log(`token radar: ${board.length} rows, median base ${base}`);