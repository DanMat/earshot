import { forwardRef, useRef, useState } from 'react';
import type { Stats } from './data.js';
import { monthYear, num } from './format.js';

/**
 * Off-screen branded card captured to PNG for sharing. Text/CSS only — no
 * external images (Amazon cover CDN taints the canvas and breaks the export).
 * Fixed 1080×1350 (portrait, share-friendly).
 */
export const ShareCard = forwardRef<HTMLDivElement, { stats: Stats }>(({ stats }, ref) => {
	const t = stats.totals;
	const lead = stats.topNarrators[0];
	const series = stats.series.filter((s) => s.finished > 0).slice(0, 3);
	const roadTrips = Math.round(t.finishedHours / 45);

	return (
		<div ref={ref} className="sharecard">
			<div className="sc-top">
				<span className="sc-brand">
					<span className="sc-wave" aria-hidden="true">
						<i />
						<i />
						<i />
						<i />
					</span>
					EARSHOT
				</span>
				<span className="sc-range">
					{monthYear(stats.span.first)} — {monthYear(stats.span.last)}
				</span>
			</div>

			<div className="sc-hero">
				<div className="sc-kicker">My audiobook year</div>
				<div className="sc-big">{num(t.finishedHours)}</div>
				<div className="sc-unit">hours listened</div>
				<div className="sc-sub">
					<b>{t.finished}</b> books finished · <b>{t.narrators}</b> narrators · <b>{roadTrips}×</b>{' '}
					coast-to-coast
				</div>
			</div>

			{lead ? (
				<div className="sc-lead">
					<div className="sc-lead-label">Most-heard narrator</div>
					<div className="sc-lead-name">{lead.name}</div>
					<div className="sc-lead-count">{lead.count} books together</div>
				</div>
			) : null}

			{series.length ? (
				<div className="sc-series">
					<div className="sc-series-label">Series I fell into</div>
					{series.map((s) => (
						<div className="sc-serie" key={s.title}>
							<span className="sc-serie-t">{s.title}</span>
							<span className="sc-serie-f">
								{s.finished}/{s.owned}
							</span>
						</div>
					))}
				</div>
			) : null}

			<div className="sc-foot">earshot.danmat.workers.dev</div>
		</div>
	);
});
ShareCard.displayName = 'ShareCard';

export function Share({ stats }: { stats: Stats }) {
	const ref = useRef<HTMLDivElement>(null);
	const [busy, setBusy] = useState(false);

	const go = async () => {
		if (!ref.current) return;
		setBusy(true);
		try {
			const { domToBlob } = await import('modern-screenshot');
			const blob = await domToBlob(ref.current, { scale: 2, width: 1080, height: 1350 });
			if (!blob) throw new Error('render failed');
			const file = new File([blob], 'my-audiobook-year.png', { type: 'image/png' });
			if (navigator.canShare?.({ files: [file] })) {
				await navigator.share({
					files: [file],
					title: 'My audiobook year',
					text: 'My year in audiobooks — made with earshot',
				});
			} else {
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = 'my-audiobook-year.png';
				a.click();
				URL.revokeObjectURL(url);
			}
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') return; // user cancelled share sheet
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<button type="button" className="share-btn" onClick={go} disabled={busy}>
				{busy ? 'Rendering…' : '📸 Share my year'}
			</button>
			<div className="sharecard-holder" aria-hidden="true">
				<ShareCard ref={ref} stats={stats} />
			</div>
		</>
	);
}
