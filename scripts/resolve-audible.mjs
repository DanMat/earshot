import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Find the `audible` binary. Prefers PATH; falls back to the common pipx
 * locations so a fresh shell (where `pipx ensurepath` hasn't taken effect yet)
 * still works. Returns the resolved path/command, or null if not found.
 */
export function resolveAudible() {
	if (process.env.AUDIBLE_BIN && existsSync(process.env.AUDIBLE_BIN)) {
		return process.env.AUDIBLE_BIN;
	}
	try {
		const onPath = execSync('command -v audible', { encoding: 'utf8' }).trim();
		if (onPath) return onPath;
	} catch {
		// not on PATH — try known install locations below
	}
	const candidates = [
		join(homedir(), '.local', 'bin', 'audible'),
		join(homedir(), 'Library', 'Application Support', 'pipx', 'venvs', 'audible-cli', 'bin', 'audible'),
	];
	return candidates.find((p) => existsSync(p)) ?? null;
}
