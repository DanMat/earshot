#!/usr/bin/env node
/**
 * ONE-TIME local setup. Run: `pnpm setup:auth`
 *
 *   1. Logs you into Audible (you handle any CAPTCHA / OTP once, at the keyboard).
 *   2. Exports your library so we can see the real fields (spike output → data/).
 *   3. Stores the two device credentials the CI pull needs as GitHub secrets
 *      (AUDIBLE_ADP_TOKEN + AUDIBLE_DEVICE_PRIVATE_KEY), plus an
 *      AUDIBLE_COUNTRY_CODE variable for the marketplace.
 *
 * The cron workflow rebuilds a minimal auth file from just those two secrets, so
 * no access/refresh tokens, cookies, or account details ever leave this machine.
 * Your Amazon credentials stay local too — only the device token and private key
 * (not your password) are stored, encrypted, as GitHub secrets.
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveAudible } from './resolve-audible.mjs';

const CONFIG_DIR = join(homedir(), '.audible');

function has(cmd) {
	try {
		execSync(`command -v ${cmd}`, { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

function die(msg) {
	console.error(`\n✗ ${msg}\n`);
	process.exit(1);
}

// ── Preflight ────────────────────────────────────────────────────────────────
const AUDIBLE = resolveAudible();
if (!AUDIBLE) {
	die(
		'audible-cli not found. Install it once (it is a Python tool):\n' +
			'    pipx install audible-cli\n' +
			'  (or, if you don\'t have pipx:  pip install --user audible-cli)',
	);
}
if (!has('gh')) {
	die('GitHub CLI not found. Install `gh` and run `gh auth login` first.');
}

// ── 1. Log in (interactive) ──────────────────────────────────────────────────
if (existsSync(CONFIG_DIR) && readdirSync(CONFIG_DIR).some((f) => f.endsWith('.json'))) {
	console.log('→ Existing Audible auth found in ~/.audible — skipping login.');
	console.log('  (Delete ~/.audible and re-run if you want to start fresh.)');
} else {
	console.log('→ Launching Audible login (audible quickstart).');
	console.log('  Answer the prompts and sign in — clear any CAPTCHA/2FA here, once.\n');
	execFileSync(AUDIBLE, ['quickstart'], { stdio: 'inherit' });
}

// ── 2. Export the library (the spike) ────────────────────────────────────────
console.log('\n→ Pulling your library so we can see the fields…');
execFileSync('node', ['scripts/pull.mjs'], {
	stdio: 'inherit',
	env: { ...process.env, AUDIBLE_BIN: AUDIBLE },
});

// ── 3. Store the two device credentials + marketplace on GitHub ───────────────
// The CI pull only needs adp_token + device_private_key (the workflow rebuilds a
// minimal auth.json from them). Find whichever *.json in the config dir actually
// holds those fields — the auth file is named audible.json in some setups.
console.log('\n→ Reading your device credentials from ~/.audible…');

function findAuth() {
	for (const f of readdirSync(CONFIG_DIR).filter((f) => f.endsWith('.json'))) {
		try {
			const data = JSON.parse(readFileSync(join(CONFIG_DIR, f), 'utf8'));
			if (data.adp_token && data.device_private_key) return data;
		} catch {
			// not JSON, or unreadable — skip
		}
	}
	return null;
}

const auth = findAuth();
if (!auth) {
	die('No auth file with adp_token + device_private_key found in ~/.audible.\n' +
		'  Run `audible quickstart` first, then re-run `pnpm setup:auth`.');
}

// Marketplace lives in config.toml (country_code = "..."); default to us.
let country = 'us';
const configToml = join(CONFIG_DIR, 'config.toml');
if (existsSync(configToml)) {
	const m = readFileSync(configToml, 'utf8').match(/country_code\s*=\s*"([^"]+)"/);
	if (m) country = m[1];
}

// Values go in on stdin — never in argv, never echoed to the terminal.
function setSecret(name, value) {
	execFileSync('gh', ['secret', 'set', name], {
		input: value,
		stdio: ['pipe', 'inherit', 'inherit'],
	});
}

console.log('→ Storing AUDIBLE_ADP_TOKEN + AUDIBLE_DEVICE_PRIVATE_KEY secrets…');
setSecret('AUDIBLE_ADP_TOKEN', auth.adp_token);
setSecret('AUDIBLE_DEVICE_PRIVATE_KEY', auth.device_private_key);

console.log(`→ Setting AUDIBLE_COUNTRY_CODE variable (${country})…`);
execFileSync('gh', ['variable', 'set', 'AUDIBLE_COUNTRY_CODE', '--body', country], {
	stdio: 'inherit',
});

console.log(`
✓ Done.
  • data/library.json          — your library (gitignored). Share the field names and we'll design from there.
  • AUDIBLE_ADP_TOKEN          — device token (GitHub secret).
  • AUDIBLE_DEVICE_PRIVATE_KEY — device private key (GitHub secret).
  • AUDIBLE_COUNTRY_CODE       — marketplace "${country}" (GitHub variable).

The cron pull rebuilds a minimal auth file from the two secrets. Nothing else
(access/refresh tokens, cookies, account details) leaves this machine, and your
Amazon password never did.
`);
