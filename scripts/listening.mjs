#!/usr/bin/env node
/**
 * Pull my Audible listening-time stats → data/listening.json.
 * Endpoint: 1.0/stats/aggregates (needs store=Audible). Returns real listened
 * milliseconds, which we convert to minutes/hours:
 *   - total (lifetime)
 *   - per month (last 24 months) — real hours listened, not just finishes
 *   - per day (last 53 weeks) — powers the listening heatmap
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolveAudible } from './resolve-audible.mjs';

const AUDIBLE = resolveAudible();
if (!AUDIBLE) {
	console.error('\n✗ audible-cli not found. Run `pnpm setup:auth` first.\n');
	process.exit(1);
}

const api = (params) =>
	JSON.parse(
		execFileSync(
			AUDIBLE,
			['api', '1.0/stats/aggregates', '-p', 'store=Audible', ...params.flatMap((p) => ['-p', p])],
			{ encoding: 'utf8', maxBuffer: 1 << 26 },
		),
	);

console.log('→ Pulling Audible listening stats → data/listening.json');

const today = new Date();
const DAYS = 371; // 53 weeks, for a full heatmap grid
const startDate = new Date(today);
startDate.setUTCDate(startDate.getUTCDate() - (DAYS - 1));
const startDay = startDate.toISOString().slice(0, 10);
const startMonth = `${today.getUTCFullYear() - 2}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;

// The daily endpoint caps a request at 30 days, so walk it in 30-day windows.
const dailyStats = [];
for (let offset = 0, cursor = new Date(startDate); offset < DAYS; offset += 30) {
	const dur = Math.min(30, DAYS - offset);
	const res = api([
		`daily_listening_interval_duration=${dur}`,
		`daily_listening_interval_start_date=${cursor.toISOString().slice(0, 10)}`,
	]);
	dailyStats.push(...(res.aggregated_daily_listening_stats ?? []));
	cursor.setUTCDate(cursor.getUTCDate() + dur);
}
const daily = { aggregated_daily_listening_stats: dailyStats };

// Monthly caps at 12 months per request, so walk it in 12-month windows.
const monthlyStats = [];
const [sy, sm] = startMonth.split('-').map(Number);
for (let i = 0; i < 24; i += 12) {
	const d = new Date(Date.UTC(sy, sm - 1 + i, 1));
	const res = api([
		'monthly_listening_interval_duration=12',
		`monthly_listening_interval_start_date=${d.toISOString().slice(0, 7)}`,
	]);
	monthlyStats.push(...(res.aggregated_monthly_listening_stats ?? []));
}
const monthly = { aggregated_monthly_listening_stats: monthlyStats };
const total = api(['response_groups=total_listening_stats']);

const toMin = (ms) => Math.round(ms / 60000);

const out = {
	totalHours: Math.round((total.aggregated_total_listening_stats?.aggregated_sum ?? 0) / 3_600_000),
	startDay,
	daily: (daily.aggregated_daily_listening_stats ?? []).map((d) => ({
		date: d.interval_identifier,
		min: toMin(d.aggregated_sum),
	})),
	monthly: (monthly.aggregated_monthly_listening_stats ?? []).map((m) => ({
		ym: m.interval_identifier,
		min: toMin(m.aggregated_sum),
	})),
};

writeFileSync('public/data/listening.json', `${JSON.stringify(out)}\n`);
console.log(
	`✓ listening.json — ${out.totalHours}h lifetime, ${out.daily.length} days, ${out.monthly.length} months`,
);
