import { useEffect, useMemo, useState } from 'react';
import type { Book, EarshotData, Stats } from './data.js';
import { loadData } from './data.js';
import { hours, monthsBetween, monthYear, names, num, shortMonth } from './format.js';

export function App() {
	const [data, setData] = useState<EarshotData | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		loadData()
			.then(setData)
			.catch(() => setFailed(true));
	}, []);

	if (failed)
		return (
			<main className="wrap">
				<p className="loading">Couldn’t load the library.</p>
			</main>
		);
	if (!data)
		return (
			<main className="wrap">
				<p className="loading">Cueing up the tape…</p>
			</main>
		);

	const { books, stats } = data;

	return (
		<main className="wrap">
			<Hero books={books} stats={stats} />
			<Narrators books={books} stats={stats} />
			<Series stats={stats} />
			<Timeline stats={stats} />
			<Library books={books} />
			<Footer stats={stats} />
		</main>
	);
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ books, stats }: { books: Book[]; stats: Stats }) {
	const t = stats.totals;
	const months = monthsBetween(stats.span.first, stats.span.last);
	const perMonth = (t.finished / months).toFixed(1);
	const avgLen =
		books.filter((b) => b.finished).reduce((s, b) => s + (b.runtimeMin ?? 0), 0) /
		(t.finished || 1);

	return (
		<header className="hero">
			<div className="brand">
				<span className="wave" aria-hidden="true">
					<i />
					<i />
					<i />
					<i />
				</span>
				earshot
			</div>
			<h1>
				<em>{num(t.finishedHours)} hours</em> of books,
				<br />
				straight into my ears.
			</h1>
			<p className="lede">
				Since {monthYear(stats.span.first)} I’ve finished <strong>{t.finished} audiobooks</strong> —
				about {perMonth} a month, {hours(avgLen)} apiece. Squeezed into commutes, dishes, and the
				quiet after the kids are down. Here’s the year in voices.
			</p>

			<div className="figures">
				<Figure n={num(t.finishedHours)} sub="hrs" k="Finished listening" />
				<Figure n={String(t.finished)} k="Books finished" />
				<Figure n={String(t.libraryDays)} sub="days" k="In the library" />
				<Figure n={String(t.notStarted)} k="Antilibrary (unstarted)" />
			</div>
		</header>
	);
}

function Figure({ n, sub, k }: { n: string; sub?: string; k: string }) {
	return (
		<div className="figure">
			<div className="n">
				{n}
				{sub ? <small>{sub}</small> : null}
			</div>
			<div className="k">{k}</div>
		</div>
	);
}

// ── Narrators (the spine) ─────────────────────────────────────────────────────
function Narrators({ books, stats }: { books: Book[]; stats: Stats }) {
	const finished = books.filter((b) => b.finished);
	const lead = stats.topNarrators[0];
	const leadStats = useMemo(() => {
		if (!lead) return null;
		const theirs = finished.filter((b) => b.narrators.includes(lead.name));
		const mins = theirs.reduce((s, b) => s + (b.runtimeMin ?? 0), 0);
		return { hours: Math.round(mins / 60), titles: theirs.map((b) => b.title) };
	}, [finished, lead]);

	const max = stats.topNarrators[0]?.count ?? 1;

	return (
		<section className="section" aria-labelledby="voices">
			<p className="section-label">The voices in my ears</p>
			<h2 id="voices">Narrators, not just authors</h2>
			<p className="intro">
				A book lives or dies on its narrator. These are the voices I spent the most time with — the
				ones my brain now hears whenever I open the next one.
			</p>

			{lead && leadStats ? (
				<div className="narrator-lead">
					<div className="avatar" aria-hidden="true">
						{initials(lead.name)}
					</div>
					<div>
						<div className="who">{lead.name}</div>
						<div className="sub">
							My most-heard narrator — <b>{lead.count} finished books</b>, roughly{' '}
							<b>{leadStats.hours} hours</b> in their company.
						</div>
					</div>
				</div>
			) : null}

			<div className="cols">
				<div className="col">
					<h3>Most-heard narrators</h3>
					<Ranked items={stats.topNarrators.slice(0, 8)} max={max} />
				</div>
				<div className="col">
					<h3>Most-read authors</h3>
					<Ranked items={stats.topAuthors.slice(0, 8)} max={stats.topAuthors[0]?.count ?? 1} />
				</div>
			</div>
		</section>
	);
}

function Ranked({ items, max }: { items: { name: string; count: number }[]; max: number }) {
	return (
		<div className="rank">
			{items.map((it, idx) => (
				<div className="rank-row" key={it.name}>
					<span className="i">{idx + 1}</span>
					<span className="name">{it.name}</span>
					<span className="bar" aria-hidden="true">
						<i style={{ width: `${(it.count / max) * 100}%` }} />
					</span>
					<span className="c">{it.count}</span>
				</div>
			))}
		</div>
	);
}

// ── Series completion ─────────────────────────────────────────────────────────
function Series({ stats }: { stats: Stats }) {
	// Only series I've actually started, most-read first, cap the list.
	const series = stats.series.filter((s) => s.finished > 0).slice(0, 10);
	return (
		<section className="section" aria-labelledby="series">
			<p className="section-label">Down the rabbit hole</p>
			<h2 id="series">Series I fell into</h2>
			<p className="intro">
				Once a series has me, it really has me. How far I’ve gotten through the ones I own.
			</p>
			<div className="series-list">
				{series.map((s) => {
					const done = s.finished >= s.owned;
					return (
						<div className={done ? 'serie done' : 'serie'} key={s.title}>
							<div className="top">
								<span className="t">
									{s.title} {done ? <span className="tag">complete</span> : null}
								</span>
								<span className="frac">
									{s.finished} / {s.owned}
								</span>
							</div>
							<div className="track" aria-hidden="true">
								<i style={{ width: `${(s.finished / s.owned) * 100}%` }} />
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}

// ── Timeline ──────────────────────────────────────────────────────────────────
function Timeline({ stats }: { stats: Stats }) {
	const buckets = useMemo(() => monthBuckets(stats), [stats]);
	const max = Math.max(1, ...buckets.map((b) => b.count));
	return (
		<section className="section" aria-labelledby="timeline">
			<p className="section-label">Month by month</p>
			<h2 id="timeline">The year in finishes</h2>
			<p className="intro">Every bar is a book crossed off. Some months the ears were busy.</p>
			<div className="timeline" role="img" aria-label="Books finished per month">
				{buckets.map((b) => (
					<div className="tl-col" key={b.ym} title={`${b.count} in ${shortMonth(b.ym)}`}>
						<span className="tl-n">{b.count || ''}</span>
						<div className="tl-bar" style={{ height: `${(b.count / max) * 100}%` }} />
						<span className="tl-m">{shortMonth(b.ym)}</span>
					</div>
				))}
			</div>
		</section>
	);
}

// ── Library ───────────────────────────────────────────────────────────────────
type Filter = 'all' | 'finished' | 'progress' | 'unstarted';

function Library({ books }: { books: Book[] }) {
	const [filter, setFilter] = useState<Filter>('finished');

	const counts = useMemo(
		() => ({
			all: books.length,
			finished: books.filter((b) => b.finished).length,
			progress: books.filter((b) => !b.finished && b.percentComplete > 0).length,
			unstarted: books.filter((b) => b.percentComplete === 0).length,
		}),
		[books],
	);

	const shown = useMemo(() => {
		const match = (b: Book) =>
			filter === 'all' ||
			(filter === 'finished' && b.finished) ||
			(filter === 'progress' && !b.finished && b.percentComplete > 0) ||
			(filter === 'unstarted' && b.percentComplete === 0);
		return books
			.filter(match)
			.sort(
				(a, b) =>
					(b.finishedAt ?? '').localeCompare(a.finishedAt ?? '') || a.title.localeCompare(b.title),
			);
	}, [books, filter]);

	const tabs: { id: Filter; label: string }[] = [
		{ id: 'finished', label: 'Finished' },
		{ id: 'progress', label: 'In progress' },
		{ id: 'unstarted', label: 'Antilibrary' },
		{ id: 'all', label: 'Everything' },
	];

	return (
		<section className="section" aria-labelledby="library">
			<p className="section-label">The whole shelf</p>
			<h2 id="library">Every book</h2>
			<div className="filters">
				{tabs.map((t) => (
					<button
						type="button"
						key={t.id}
						className={filter === t.id ? 'filter active' : 'filter'}
						onClick={() => setFilter(t.id)}
					>
						{t.label}
						<span className="c">{counts[t.id]}</span>
					</button>
				))}
			</div>
			<div className="grid">
				{shown.map((b) => (
					<Card key={b.asin} book={b} />
				))}
			</div>
		</section>
	);
}

function Card({ book: b }: { book: Book }) {
	const inProgress = !b.finished && b.percentComplete > 0;
	return (
		<article className="card">
			<a
				className="cover"
				href={b.audibleUrl ?? '#'}
				target="_blank"
				rel="noreferrer"
				title={`${b.title} on Audible`}
			>
				{b.coverUrl ? <img src={b.coverUrl} alt="" loading="lazy" /> : null}
				{b.finished ? <span className="badge fin">Finished</span> : null}
				{inProgress ? <span className="badge prog">{b.percentComplete}%</span> : null}
				{inProgress ? (
					<span className="prog-bar" aria-hidden="true">
						<i style={{ width: `${b.percentComplete}%` }} />
					</span>
				) : null}
			</a>
			<div className="ct">{b.title}</div>
			<div className="cmeta">{names(b.authors)}</div>
			{b.narrators.length ? (
				<div className="cnarr" title="Narrated by">
					🎙 {names(b.narrators)}
				</div>
			) : null}
		</article>
	);
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer({ stats }: { stats: Stats }) {
	return (
		<footer className="foot">
			<strong style={{ color: 'var(--muted)' }}>earshot</strong> — my listening, pulled
			automatically from Audible and refreshed daily. {stats.totals.finished} finished,{' '}
			{num(stats.totals.finishedHours)} hours, last updated {monthYear(stats.span.last)}.
			<br />
			Metadata only (titles, authors, narrators, my own progress) — no book text or audio. Ratings
			are Audible’s community figures. Built with React + Vite on Cloudflare.{' '}
			<a href="https://github.com/DanMat/earshot" target="_blank" rel="noreferrer">
				Source
			</a>
			.
		</footer>
	);
}

// ── helpers ───────────────────────────────────────────────────────────────────
function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? '')
		.join('');
}

function monthBuckets(stats: Stats): { ym: string; count: number }[] {
	const { first, last } = stats.span;
	if (!first || !last) return [];
	const start = new Date(first);
	const end = new Date(last);
	const out: { ym: string; count: number }[] = [];
	const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
	while (d <= end) {
		const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
		out.push({ ym, count: stats.byMonth[ym] ?? 0 });
		d.setUTCMonth(d.getUTCMonth() + 1);
	}
	return out;
}
