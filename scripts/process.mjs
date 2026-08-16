#!/usr/bin/env node
/**
 * Turn the raw Audible pull (data/library.json, gitignored) into a curated,
 * copyright-safe PUBLIC dataset that the site + cron Action can publish.
 *
 * Whitelist only. We keep facts about *my own* listening — titles, authors,
 * narrators, runtime, series, finished status, community ratings, cover art,
 * and a link out to Audible. We deliberately DROP: order/account/entitlement
 * fields, prices, and Audible's copyrighted publisher summaries / reviews.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync('data/library.json', 'utf8'));
const items = raw.items ?? [];

const names = (arr) => (arr ?? []).map((x) => x?.name).filter(Boolean);

/** Broadest genre from each category ladder (e.g. "Science Fiction & Fantasy"). */
function genres(b) {
	const out = new Set();
	for (const cl of b.category_ladders ?? []) {
		const first = cl?.ladder?.[0]?.name;
		if (first) out.add(first);
	}
	return [...out];
}

function coverUrl(b) {
	const imgs = b.product_images ?? {};
	// pick the largest available square
	const key = Object.keys(imgs)
		.map(Number)
		.filter((n) => !Number.isNaN(n))
		.sort((a, z) => z - a)[0];
	return (key != null ? imgs[key] : b.image_url) ?? null;
}

const books = items.map((b) => {
	const ls = b.listening_status ?? {};
	const r = b.rating?.overall_distribution ?? {};
	const perf = b.rating?.performance_distribution ?? {};
	const story = b.rating?.story_distribution ?? {};
	return {
		asin: b.asin,
		title: b.title,
		subtitle: b.subtitle ?? null,
		authors: names(b.authors),
		narrators: names(b.narrators),
		series: (b.series ?? []).map((s) => ({ title: s.title, sequence: s.sequence ?? null })),
		genres: genres(b),
		language: b.language ?? null,
		contentType: b.content_type ?? null, // "Product" | "Performance" (full-cast)
		runtimeMin: b.runtime_length_min ?? null,
		releaseDate: b.release_date ?? null,
		purchaseDate: b.purchase_date ?? null,
		finished: ls.is_finished === true,
		percentComplete: ls.percent_complete ?? 0,
		finishedAt: ls.finished_at_timestamp ?? null,
		// community ratings (public facts) — overall / narration / story
		rating: {
			overall: r.display_average_rating ? Number(r.display_average_rating) : null,
			narration: perf.display_average_rating ? Number(perf.display_average_rating) : null,
			story: story.display_average_rating ? Number(story.display_average_rating) : null,
			// rounded to the nearest 100 — a retrospective wants a stable snapshot,
			// not a daily commit every time a stranger rates the book.
			count: r.num_ratings ? Math.round(r.num_ratings / 100) * 100 : null,
		},
		coverUrl: coverUrl(b),
		audibleUrl: b.product_page_url ?? (b.asin ? `https://www.audible.com/pd/${b.asin}` : null),
	};
});

// ── Aggregate stats for the retrospective ────────────────────────────────────
const finished = books.filter((b) => b.finished);
const inProgress = books.filter((b) => !b.finished && b.percentComplete > 0);
const notStarted = books.filter((b) => b.percentComplete === 0);
const hrs = (arr) => Math.round(arr.reduce((s, b) => s + (b.runtimeMin || 0), 0) / 60);

function tally(arr, keyFn) {
	const m = new Map();
	for (const b of arr) for (const k of keyFn(b)) m.set(k, (m.get(k) ?? 0) + 1);
	return [...m.entries()].sort((a, z) => z[1] - a[1]).map(([name, count]) => ({ name, count }));
}

// series completion: how many of each owned series are finished
const seriesMap = new Map();
for (const b of books) {
	for (const s of b.series) {
		if (!s.title) continue;
		const e = seriesMap.get(s.title) ?? { title: s.title, owned: 0, finished: 0 };
		e.owned += 1;
		if (b.finished) e.finished += 1;
		seriesMap.set(s.title, e);
	}
}
const series = [...seriesMap.values()]
	.filter((s) => s.owned > 1)
	.sort((a, z) => z.owned - a.owned);

// finishes by month (YYYY-MM) for the timeline
const byMonth = {};
for (const b of finished) {
	if (!b.finishedAt) continue;
	const m = b.finishedAt.slice(0, 7);
	byMonth[m] = (byMonth[m] ?? 0) + 1;
}

const stats = {
	totals: {
		library: books.length,
		finished: finished.length,
		inProgress: inProgress.length,
		notStarted: notStarted.length,
		finishedHours: hrs(finished),
		libraryHours: hrs(books),
		libraryDays: Math.round(hrs(books) / 24),
	},
	span: {
		first: finished.map((b) => b.finishedAt).filter(Boolean).sort()[0] ?? null,
		last: finished.map((b) => b.finishedAt).filter(Boolean).sort().at(-1) ?? null,
	},
	topNarrators: tally(finished, (b) => b.narrators).slice(0, 12),
	topAuthors: tally(finished, (b) => b.authors).slice(0, 12),
	topGenres: tally(finished, (b) => b.genres).slice(0, 10),
	series,
	byMonth,
	longest: finished
		.slice()
		.sort((a, z) => (z.runtimeMin || 0) - (a.runtimeMin || 0))
		.slice(0, 5)
		.map((b) => ({ title: b.title, runtimeMin: b.runtimeMin })),
};

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/library.json', `${JSON.stringify(books, null, 2)}\n`);
writeFileSync('public/data/stats.json', `${JSON.stringify(stats, null, 2)}\n`);

console.log(
	`✓ public/data/library.json (${books.length} books) + stats.json ` +
		`(${stats.totals.finished} finished, ${stats.totals.finishedHours}h)`,
);
