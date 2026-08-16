#!/usr/bin/env node
/**
 * Pull the Audible library to data/library.json.
 *
 * Reusable: run locally after setup:auth, or in CI (the workflow restores the
 * auth into ~/.audible from the AUDIBLE_CONFIG secret before calling this).
 *
 * The full `library` export (with contributors) gives us the fields that make
 * this project interesting — narrators, series, runtime — not just titles.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('data', { recursive: true });

// Response groups pull the good stuff: narrators (contributors), series,
// runtime, ratings, categories. If a group is unsupported it's ignored server-side.
const RESPONSE_GROUPS = [
	'contributors',
	'series',
	'product_attrs',
	'product_desc',
	'product_extended_attrs',
	'category_ladders',
	'rating',
	'listening_status',
].join(',');

const run = (args) => execFileSync('audible', args, { stdio: 'inherit' });

console.log('→ Exporting your Audible library → data/library.json');
try {
	// Raw API call keeps every field so we can see exactly what's available.
	run([
		'api',
		'1.0/library',
		'-p',
		'num_results=1000',
		'-p',
		`response_groups=${RESPONSE_GROUPS}`,
		'-o',
		'data/library.json',
	]);
} catch {
	// Fallback to the friendlier exporter if the raw API shape changes.
	console.log('  (api call failed — falling back to `library export`)');
	run(['library', 'export', '--format', 'json', '--output', 'data/library.json']);
}

console.log('✓ Wrote data/library.json');
