#!/usr/bin/env node
/**
 * Enrich top narrators + authors with short, copyright-safe bio snippets from
 * Wikipedia (CC BY-SA — we store a trimmed extract + attribution link, never the
 * whole article). Results are cached in public/data/people.json so daily runs
 * only fetch names we haven't seen — and negative results are cached too.
 *
 * Accuracy guard: Wikipedia is full of namesakes (Heath Miller the NFL player!),
 * so we only accept a page whose description/extract actually reads like a
 * narrator/author/actor. If nothing matches, we store {found:false} and show
 * no bio rather than a wrong one.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const UA = 'earshot/1.0 (https://github.com/DanMat/earshot; audiobook retrospective)';
const CACHE = 'public/data/people.json';
const ROLE = /\b(narrat|voice[ -]?(actor|over)|audiobook|actor|actress|author|writer|novelist|screenwriter|playwright|comedian)\b/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function summary(title) {
	try {
		const r = await fetch(
			`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`,
			{ headers: { 'User-Agent': UA } },
		);
		if (!r.ok) return null;
		const j = await r.json();
		if (j.type === 'disambiguation') return null;
		return j;
	} catch {
		return null;
	}
}

async function search(q) {
	try {
		const u = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=5`;
		const r = await fetch(u, { headers: { 'User-Agent': UA } });
		const j = await r.json();
		return (j.query?.search ?? []).map((s) => s.title);
	} catch {
		return [];
	}
}

const roleMatch = (s) => s && ROLE.test(`${s.description ?? ''} ${s.extract ?? ''}`);

// Identity guard: every significant token of the searched name must appear in the
// matched page's title. Stops namesakes ("Heath Miller" → Sienna Miller) and
// related-person drift ("Jeff Hays" → Matt Dinniman, whose books he narrates).
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nameTokens = (s) => norm(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
function nameMatch(query, title) {
	if (!title) return false;
	const q = nameTokens(query);
	const t = new Set(nameTokens(title));
	return q.length > 0 && q.every((tok) => t.has(tok));
}

const accept = (query, s) => roleMatch(s) && nameMatch(query, s.title);

/** first 1–2 sentences, capped ~260 chars */
function trim(extract) {
	if (!extract) return '';
	const capped = extract.length > 300 ? `${extract.slice(0, 260).replace(/\s+\S*$/, '')}…` : extract;
	return capped;
}

function record(s) {
	return {
		found: true,
		extract: trim(s.extract),
		url: s.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title)}`,
		wikiTitle: s.title,
	};
}

async function resolve(name) {
	// 1. exact page
	let s = await summary(name);
	if (accept(name, s)) return record(s);
	// 2. scoped searches, most specific first
	for (const q of [`${name} narrator`, `${name} audiobook`, `${name} author`, name]) {
		const titles = await search(q);
		await sleep(150);
		for (const t of titles.slice(0, 3)) {
			s = await summary(t);
			await sleep(150);
			if (accept(name, s)) return record(s);
		}
	}
	return { found: false };
}

// ── run ───────────────────────────────────────────────────────────────────────
// Found bios are cached forever (they rarely change). Misses are cached with a
// timestamp and periodically re-checked, so someone who *gets* a Wikipedia page
// later (e.g. a rising indie narrator) is eventually picked up.
const STALE_MS = 30 * 24 * 60 * 60 * 1000; // re-check misses after 30 days
const now = Date.now();
const isStaleMiss = (e) =>
	e && e.found === false && (!e.checkedAt || now - Date.parse(e.checkedAt) > STALE_MS);

const stats = JSON.parse(readFileSync('public/data/stats.json', 'utf8'));
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

const wanted = [
	...stats.topNarrators.map((x) => x.name),
	...stats.topAuthors.map((x) => x.name),
];
const todo = [...new Set(wanted)].filter((name) => !(name in cache) || isStaleMiss(cache[name]));

const fresh = todo.filter((n) => !(n in cache)).length;
console.log(
	`→ enriching ${todo.length} name(s): ${fresh} new, ${todo.length - fresh} stale re-check ` +
		`(${Object.keys(cache).length} cached)`,
);
let hits = 0;
for (const name of todo) {
	const res = await resolve(name);
	// stamp misses so we re-check them on a cadence, not every run
	cache[name] = res.found ? res : { found: false, checkedAt: new Date().toISOString() };
	if (res.found) hits++;
	console.log(`   ${res.found ? '✓' : '·'} ${name}`);
	await sleep(200);
}

writeFileSync(CACHE, `${JSON.stringify(cache, null, 2)}\n`);
console.log(`✓ people.json — ${hits}/${todo.length} matched this run`);
