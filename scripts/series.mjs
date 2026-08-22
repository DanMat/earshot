#!/usr/bin/env node
/**
 * Resolve the TRUE length of each series → data/series.json.
 *
 * The library only knows how many books of a series I *own*, so "finished == owned"
 * wrongly reads as "series complete" (I own 3 of the 5 Gideon Crew books). Audible's
 * catalog knows the real count: any book links to its series "parent" product, and
 * the parent lists every member. True length = the distinct sequence numbers.
 *
 * Cached in public/data/series.json ({ "<series title>": <total> }); refreshed for
 * series we haven't measured yet. Uses the public catalog (no auth-scoped data).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolveAudible } from './resolve-audible.mjs';

const AUDIBLE = resolveAudible();
if (!AUDIBLE) {
	console.error('\n✗ audible-cli not found. Run `pnpm setup:auth` first.\n');
	process.exit(1);
}

const CACHE = 'public/data/series.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function api(asin) {
	for (let i = 0; i < 3; i++) {
		try {
			return JSON.parse(
				execFileSync(AUDIBLE, ['api', `1.0/catalog/products/${asin}`, '-p', 'response_groups=relationships'], {
					encoding: 'utf8',
					maxBuffer: 1 << 26,
				}),
			);
		} catch {
			// backoff and retry (rate limiting)
		}
	}
	return null;
}

const seriesRels = (product) =>
	(product?.relationships ?? []).filter((r) => r.relationship_type === 'series');

const books = JSON.parse(readFileSync('public/data/library.json', 'utf8'));
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

// series title -> a member ASIN we can start from
const memberAsin = new Map();
for (const b of books) {
	for (const s of b.series ?? []) {
		if (s.title && !memberAsin.has(s.title)) memberAsin.set(s.title, b.asin);
	}
}

const todo = [...memberAsin.keys()].filter((t) => !(t in cache));
console.log(`→ measuring ${todo.length} series (${Object.keys(cache).length} cached)`);

for (const title of todo) {
	const start = memberAsin.get(title);
	const rel = api(start);
	await sleep(150);
	const parent = seriesRels(rel?.product).find((r) => r.relationship_to_product === 'parent')?.asin;

	let total = null;
	if (parent) {
		const prel = api(parent);
		await sleep(150);
		const seqs = seriesRels(prel?.product)
			.map((r) => Number.parseFloat(r.sequence))
			.filter((n) => !Number.isNaN(n));
		if (seqs.length) total = new Set(seqs).size; // distinct volumes (collapses format dupes)
	}

	cache[title] = total;
	console.log(`   ${total ?? '?'}  ${title}`);
}

const ordered = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
writeFileSync(CACHE, `${JSON.stringify(ordered, null, 2)}\n`);
const known = Object.values(cache).filter((v) => v != null).length;
console.log(`✓ series.json — ${known}/${Object.keys(cache).length} series measured`);
