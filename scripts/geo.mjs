#!/usr/bin/env node
/**
 * Resolve each author to a country of citizenship, for the "Around the world"
 * map. Chain: author name → Wikipedia page → Wikidata item (QID) → country of
 * citizenship (P27) → that country's name (label), ISO code (P297) and centroid
 * (P625). Everything is cached in public/data/geo.json so daily runs only fetch
 * names we haven't seen; misses are cached and periodically re-checked.
 *
 * Accuracy guard (same spirit as enrich.mjs): the matched Wikidata item must be
 * a human (P31 = Q5) and its label must contain every significant token of the
 * author's name, so we never borrow a namesake's nationality. Pen names with no
 * Wikidata presence (common for web-serial authors) resolve to {found:false}
 * and simply don't appear on the map.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const UA = 'earshot/1.0 (https://github.com/DanMat/earshot; audiobook retrospective)';
const CACHE = 'public/data/geo.json';
const HUMAN = 'Q5';
// Occupation (P106) QIDs that count as "a writer". Matching on surname alone
// otherwise grabs same-surnamed non-writers (an American "Barker", etc.), so we
// require the matched person to actually write. Broad on purpose.
// Defunct/transitional ISO codes to skip so a historical citizenship doesn't win
// over a current one (e.g. Ayn Rand: Soviet Union → fall through to United States).
const DEFUNCT_ISO = new Set(['SU', 'YU', 'CS', 'DD', 'YD']);
const WRITERS = new Set([
	'Q36180', // writer
	'Q482980', // author
	'Q6625963', // novelist
	'Q49757', // poet
	'Q28389', // screenwriter
	'Q214917', // playwright
	'Q11774202', // essayist
	'Q4853732', // children's writer
	'Q18844224', // science fiction writer
	'Q12144794', // non-fiction writer
	'Q6430706', // short story writer
	'Q16031530', // fantasy writer
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const norm = (s) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase();
const nameTokens = (s) =>
	norm(s)
		.split(/[^a-z0-9]+/)
		.filter((t) => t.length >= 3);
function nameMatch(query, label) {
	if (!label) return false;
	const q = nameTokens(query);
	const t = new Set(nameTokens(label));
	return q.length > 0 && q.every((tok) => t.has(tok));
}

/** GET JSON with retry + backoff so a burst of requests doesn't get throttled
 * into false misses (429/5xx/network). Returns null only after retries. */
async function json(url, tries = 4) {
	for (let i = 0; i < tries; i++) {
		try {
			const r = await fetch(url, { headers: { 'User-Agent': UA } });
			if (r.ok) return await r.json();
			if (r.status === 429 || r.status >= 500) {
				const ra = Number(r.headers.get('retry-after'));
				await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 600 * 2 ** i);
				continue;
			}
			return null; // genuine 404 etc.
		} catch {
			await sleep(600 * 2 ** i);
		}
	}
	return null;
}

/** QID for an exact Wikipedia title (following redirects), or null. */
async function qidForTitle(title) {
	const u = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
		title,
	)}&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json`;
	const j = await json(u);
	const pages = j?.query?.pages ?? {};
	const p = Object.values(pages)[0];
	return p?.pageprops?.wikibase_item ?? null;
}

async function search(q) {
	const u = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
		q,
	)}&format=json&srlimit=5`;
	const j = await json(u);
	return (j?.query?.search ?? []).map((s) => s.title);
}

const entityCache = new Map();
async function entity(qid) {
	if (entityCache.has(qid)) return entityCache.get(qid);
	const j = await json(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
	const e = j?.entities?.[qid] ?? null;
	entityCache.set(qid, e);
	await sleep(120);
	return e;
}

const claimVal = (e, prop) => e?.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
const claimIds = (e, prop) =>
	(e?.claims?.[prop] ?? []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
const isHuman = (e) => (e?.claims?.P31 ?? []).some((c) => c.mainsnak?.datavalue?.value?.id === HUMAN);
const isWriter = (e) =>
	(e?.claims?.P106 ?? []).some((c) => WRITERS.has(c.mainsnak?.datavalue?.value?.id));
const labelEn = (e) => e?.labels?.en?.value ?? null;

/** Given a human Wikidata entity, resolve its country of citizenship record.
 * Scans every P27 value for the first that is a real modern country (has an ISO
 * code), so a historical first citizenship (Ayn Rand's "Russian Empire") or a
 * non-sovereign value (Homer's "Ionian League") is skipped rather than dropping
 * the author entirely. */
async function countryOf(personEntity) {
	for (const cQid of claimIds(personEntity, 'P27')) {
		const ce = await entity(cQid);
		const iso = claimVal(ce, 'P297'); // ISO 3166-1 alpha-2
		if (!iso || DEFUNCT_ISO.has(iso)) continue;
		const coord = claimVal(ce, 'P625');
		return {
			country: labelEn(ce),
			iso,
			lat: coord?.latitude ?? null,
			lon: coord?.longitude ?? null,
		};
	}
	return null;
}

async function resolve(name) {
	// candidate Wikidata items: exact title first, then scoped searches
	const candidates = [];
	const direct = await qidForTitle(name);
	if (direct) candidates.push(direct);
	for (const q of [`${name} author`, `${name} writer`, name]) {
		for (const t of (await search(q)).slice(0, 3)) {
			const qid = await qidForTitle(t);
			if (qid) candidates.push(qid);
		}
		await sleep(120);
	}

	for (const qid of [...new Set(candidates)]) {
		const e = await entity(qid);
		if (!e || !isHuman(e) || !isWriter(e)) continue;
		if (!nameMatch(name, labelEn(e))) continue;
		const c = await countryOf(e);
		if (c?.country) return { found: true, qid, ...c };
		return { found: false, qid }; // person found, no citizenship listed
	}
	return { found: false };
}

// ── run ─────────────────────────────────────────────────────────────────────
const STALE_MS = 30 * 24 * 60 * 60 * 1000; // re-check misses after 30 days
const now = Date.now();
const isStaleMiss = (e) =>
	e && e.found === false && (!e.checkedAt || now - Date.parse(e.checkedAt) > STALE_MS);

const books = JSON.parse(readFileSync('public/data/library.json', 'utf8'));
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

const authors = [...new Set(books.flatMap((b) => b.authors ?? []))];
const todo = authors.filter((name) => !(name in cache) || isStaleMiss(cache[name]));

const fresh = todo.filter((n) => !(n in cache)).length;
console.log(
	`→ geo-resolving ${todo.length} author(s): ${fresh} new, ${todo.length - fresh} stale re-check ` +
		`(${Object.keys(cache).length} cached)`,
);

let hits = 0;
for (const name of todo) {
	const res = await resolve(name);
	cache[name] = res.found ? res : { found: false, checkedAt: new Date().toISOString() };
	if (res.found) hits++;
	console.log(`   ${res.found ? `✓ ${res.country}` : '·'} — ${name}`);
	await sleep(150);
}

// stable key order for a clean diff
const ordered = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
writeFileSync(CACHE, `${JSON.stringify(ordered, null, 2)}\n`);
console.log(`✓ geo.json — ${hits}/${todo.length} placed this run`);
