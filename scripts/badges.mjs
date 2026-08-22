#!/usr/bin/env node
/**
 * Pull my Audible listening badges (achievements) → public/data/badges.json.
 *
 * Endpoints (undocumented internal Audible API, reached via audible-cli):
 *   1.0/badges/progress  — which badges I've earned, the level, when, progress
 *   1.0/badges/metadata  — descriptions + per-level reward blurbs
 * Both need `store=Audible` and `locale=<country>` (e.g. us).
 *
 * We keep only the achievement DATA (name/level/date/reward text/progress) and
 * render our own medallions on the site — we don't copy Audible's badge artwork.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolveAudible } from './resolve-audible.mjs';

const AUDIBLE = resolveAudible();
if (!AUDIBLE) {
	console.error('\n✗ audible-cli not found. Run `pnpm setup:auth` first.\n');
	process.exit(1);
}

const locale = (process.env.AUDIBLE_COUNTRY_CODE || 'us').toLowerCase();
const api = (endpoint) =>
	JSON.parse(
		execFileSync(AUDIBLE, ['api', endpoint, '-p', 'store=Audible', '-p', `locale=${locale}`], {
			encoding: 'utf8',
			maxBuffer: 1 << 26,
		}),
	);

console.log('→ Pulling Audible badges → data/badges.json');

const progress = api('1.0/badges/progress');
const meta = api('1.0/badges/metadata');
const byId = Object.fromEntries((meta.badge_metadata ?? []).map((b) => [b.badge_metadata_id, b]));

const RANK = { master: 4, gold: 3, silver: 2, original: 1 };

const badges = [];
for (const cb of progress.customer_badges ?? []) {
	const id = cb.badge_metadata?.badge_metadata_id;
	const md = byId[id];
	if (!id || !md) continue;

	const tier = cb.earned_badge_level?.level_metadata?.level_metadata_id ?? null;
	const level = (md.level_metadata ?? []).find((l) => l.level_metadata_id === tier);

	badges.push({
		id,
		description: md.description ?? '',
		tier, // null when not yet earned
		earnedAt: cb.earned_badge_level?.level_acquired_time ?? null,
		reward: level?.reward_description ?? null,
		next: cb.next_badge_level_metadata_id ?? null,
		percentToNext: cb.percent_progress_to_next_level ?? null,
	});
}

// Earned first (highest tier, then most recent), unearned last.
badges.sort(
	(a, b) =>
		(RANK[b.tier] ?? 0) - (RANK[a.tier] ?? 0) || (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''),
);

writeFileSync('public/data/badges.json', `${JSON.stringify(badges, null, 2)}\n`);
console.log(`✓ badges.json — ${badges.filter((b) => b.tier).length}/${badges.length} earned`);
