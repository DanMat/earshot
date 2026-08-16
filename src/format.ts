/** Formatting helpers — small, pure, tested-in-passing by the UI. */

/** 1284 → "1,284" */
export const num = (n: number): string => n.toLocaleString('en-US');

/** minutes → "10h 49m" (or "49m") */
export function hm(min: number | null): string {
	if (!min) return '—';
	const h = Math.floor(min / 60);
	const m = min % 60;
	return h ? `${h}h ${m}m` : `${m}m`;
}

/** minutes → whole hours, e.g. 649 → "11h" */
export const hours = (min: number | null): string => (min ? `${Math.round(min / 60)}h` : '—');

/** "2026-08-11T…" → "Aug 2026" */
export function monthYear(iso: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** "2026-08" → "Aug ’26" (compact, for the timeline axis) */
export function shortMonth(ym: string): string {
	const [y, m] = ym.split('-').map(Number);
	const d = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 1));
	const mon = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
	return `${mon} ’${String(y).slice(2)}`;
}

/** join a list with commas + "&" before the last: ["A","B","C"] → "A, B & C" */
export function names(list: string[]): string {
	if (list.length <= 1) return list[0] ?? '';
	return `${list.slice(0, -1).join(', ')} & ${list.at(-1)}`;
}

/** whole months between two ISO dates, min 1 */
export function monthsBetween(a: string | null, b: string | null): number {
	if (!a || !b) return 1;
	const d1 = new Date(a);
	const d2 = new Date(b);
	const m = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
	return Math.max(1, m);
}
