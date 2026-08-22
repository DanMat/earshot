#!/usr/bin/env node
/**
 * Pull my Audible wishlist (books I've saved to listen to) → data/wishlist.json.
 * Endpoint: 1.0/wishlist. Metadata only (title/authors/narrators/cover/when I
 * added it) — the same copyright-safe shape as the library.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolveAudible } from './resolve-audible.mjs';

const AUDIBLE = resolveAudible();
if (!AUDIBLE) {
	console.error('\n✗ audible-cli not found. Run `pnpm setup:auth` first.\n');
	process.exit(1);
}

console.log('→ Pulling Audible wishlist → data/wishlist.json');

const raw = JSON.parse(
	execFileSync(
		AUDIBLE,
		[
			'api',
			'1.0/wishlist',
			'-p',
			'num_results=50',
			'-p',
			'response_groups=contributors,product_desc,product_attrs,media',
		],
		{ encoding: 'utf8', maxBuffer: 1 << 26 },
	),
);

const items = (raw.products ?? [])
	.map((p) => {
		const imgs = p.product_images ?? {};
		return {
			asin: p.asin,
			title: p.title,
			authors: (p.authors ?? []).map((a) => a.name),
			narrators: (p.narrators ?? []).map((n) => n.name),
			addedAt: p.added_timestamp ?? null,
			runtimeMin: p.runtime_length_min ?? null,
			coverUrl: imgs['500'] ?? imgs['1024'] ?? Object.values(imgs)[0] ?? null,
			audibleUrl: `https://www.audible.com/pd/${p.asin}`,
		};
	})
	.sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''));

writeFileSync('public/data/wishlist.json', `${JSON.stringify(items, null, 2)}\n`);
console.log(`✓ wishlist.json — ${items.length} saved titles`);
