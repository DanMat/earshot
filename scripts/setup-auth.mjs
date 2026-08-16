#!/usr/bin/env node
/**
 * ONE-TIME local setup. Run: `pnpm setup:auth`
 *
 *   1. Logs you into Audible (you handle any CAPTCHA / OTP once, at the keyboard).
 *   2. Exports your library so we can see the real fields (spike output → data/).
 *   3. Pushes the auth to GitHub as the AUDIBLE_CONFIG secret.
 *
 * Your Amazon credentials stay on this machine. Only the resulting device-auth
 * token (not your password) is stored — encrypted — as a GitHub Actions secret.
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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
if (!has('audible')) {
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
	execFileSync('audible', ['quickstart'], { stdio: 'inherit' });
}

// ── 2. Export the library (the spike) ────────────────────────────────────────
console.log('\n→ Pulling your library so we can see the fields…');
execFileSync('node', ['scripts/pull.mjs'], { stdio: 'inherit' });

// ── 3. Store the whole auth/config dir as one GitHub secret ───────────────────
// Snapshotting the dir (config + auth file, whatever it's named) is the robust
// way to hand CI everything it needs without hardcoding filenames.
console.log('\n→ Storing your auth in the AUDIBLE_CONFIG GitHub secret…');
execSync(
	`tar czf - -C ${JSON.stringify(CONFIG_DIR)} . | base64 | gh secret set AUDIBLE_CONFIG`,
	{ stdio: 'inherit', shell: '/bin/bash' },
);

console.log(`
✓ Done.
  • data/library.json  — your library (gitignored). Share the field names and we'll design from there.
  • AUDIBLE_CONFIG      — auth stored as a GitHub secret for the cron pull.

Nothing sensitive was committed. Your Amazon password never left your machine.
`);
