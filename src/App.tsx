import { useEffect, useMemo, useState } from 'react';
import type { Book, EarshotData, People, Stats } from './data.js';
import { loadData } from './data.js';
import { hm, hours, monthsBetween, monthYear, names, num, shortMonth } from './format.js';
import { Share } from './ShareCard.js';

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

	const { books, stats, people } = data;

	return (
		<main className="wrap">
			<Hero books={books} stats={stats} />
			<Shelf books={books} />
			<Narrators books={books} stats={stats} people={people} />
			<Series stats={stats} />
			<Timeline stats={stats} />
			<FunFacts stats={stats} />
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

			<div className="hero-actions">
				<Share stats={stats} />
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

// ── Shelf ─────────────────────────────────────────────────────────────────────
// Each finished book drawn as a spine: height = listening time, colour = genre.
const GENRE_COLORS: Record<string, string> = {
	'Science Fiction & Fantasy': '#e6a34e',
	'Mystery, Thriller & Suspense': '#b5533f',
	"Children's Audiobooks": '#6f9e78',
	'Teen & Young Adult': '#5f93b0',
	'Comedy & Humor': '#e7c85a',
	'Literature & Fiction': '#a986c9',
};
const GENRE_ORDER = Object.keys(GENRE_COLORS);
const OTHER_GENRE = 'Other';
const OTHER_COLOR = '#93826c';

/** The most specific listed genre we have a colour for, else "Other". */
export function spineGenre(b: Book): string {
	for (let i = b.genres.length - 1; i >= 0; i--) {
		const g = b.genres[i];
		if (g && GENRE_COLORS[g]) return g;
	}
	return OTHER_GENRE;
}

function Shelf({ books }: { books: Book[] }) {
	const spines = useMemo(() => {
		// Finished, single-part titles only — multi-part items and dramatised
		// "Performance" editions inflate the count (see data notes).
		const rank = (g: string) => {
			const i = GENRE_ORDER.indexOf(g);
			return i === -1 ? GENRE_ORDER.length : i;
		};
		return books
			.filter((b) => b.finished && b.contentType === 'Product' && (b.runtimeMin ?? 0) > 0)
			.map((b) => ({
				title: b.title,
				author: b.authors[0] ?? '',
				min: b.runtimeMin ?? 0,
				genre: spineGenre(b),
			}))
			.sort((a, b) => rank(a.genre) - rank(b.genre) || b.min - a.min);
	}, [books]);

	if (spines.length === 0) return null;

	const min = Math.min(...spines.map((s) => s.min));
	const max = Math.max(...spines.map((s) => s.min));
	const height = (m: number) =>
		max === min ? 150 : Math.round(64 + ((m - min) / (max - min)) * (238 - 64));

	const counts = new Map<string, number>();
	for (const s of spines) counts.set(s.genre, (counts.get(s.genre) ?? 0) + 1);
	const legend = [...GENRE_ORDER, OTHER_GENRE].filter((g) => counts.has(g));

	const totalHours = Math.round(spines.reduce((s, x) => s + x.min, 0) / 60);
	const tallest = spines.reduce((a, b) => (b.min > a.min ? b : a));

	return (
		<section className="section" aria-labelledby="shelf">
			<p className="section-label">The shelf</p>
			<h2 id="shelf">Everything I finished, by the hour</h2>
			<p className="intro">
				One spine per finished book — the taller it stands, the longer the listen. Coloured by
				genre; hover any spine for the title.
			</p>

			<div className="shelf-legend">
				{legend.map((g) => (
					<span key={g}>
						<i style={{ background: GENRE_COLORS[g] ?? OTHER_COLOR }} />
						{g} <b>{counts.get(g)}</b>
					</span>
				))}
			</div>

			<div className="shelf-scroll">
				<div className="shelf-inner">
					<div
						className="shelf"
						role="img"
						aria-label={`${spines.length} finished audiobooks drawn as book spines, each spine's height set by its listening time`}
					>
						{spines.map((s, i) => (
							<div
								className="spine"
								// biome-ignore lint/suspicious/noArrayIndexKey: title+index is stable for this static, sorted list
								key={`${s.title}-${i}`}
								style={{
									height: `${height(s.min)}px`,
									background: GENRE_COLORS[s.genre] ?? OTHER_COLOR,
								}}
								title={`${s.title} · ${s.author} · ${hm(s.min)}`}
							>
								{height(s.min) > 96 ? <span className="spine-lbl">{s.title}</span> : null}
							</div>
						))}
					</div>
					<div className="shelf-ledge" aria-hidden="true" />
				</div>
			</div>

			<p className="shelf-foot">
				<b>{spines.length}</b> finished books · <b>{totalHours} hours</b> of eartime · tallest spine
				is {tallest.title} at {hours(tallest.min)}
			</p>
		</section>
	);
}

// ── Narrators (the spine) ─────────────────────────────────────────────────────
type Bio = { name: string; extract: string; url: string };

function Narrators({ books, stats, people }: { books: Book[]; stats: Stats; people: People }) {
	const finished = books.filter((b) => b.finished);
	const lead = stats.topNarrators[0];
	const [bio, setBio] = useState<Bio | null>(null);

	const leadStats = useMemo(() => {
		if (!lead) return null;
		const theirs = finished.filter((b) => b.narrators.includes(lead.name));
		const mins = theirs.reduce((s, b) => s + (b.runtimeMin ?? 0), 0);
		return { hours: Math.round(mins / 60), titles: theirs.map((b) => b.title) };
	}, [finished, lead]);

	useEffect(() => {
		if (!bio) return;
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setBio(null);
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [bio]);

	const leadBio = lead ? people[lead.name] : undefined;
	const max = stats.topNarrators[0]?.count ?? 1;

	return (
		<section className="section" aria-labelledby="voices">
			<p className="section-label">The voices in my ears</p>
			<h2 id="voices">Narrators, not just authors</h2>
			<p className="intro">
				A book lives or dies on its narrator. These are the voices I spent the most time with — the
				ones my brain now hears whenever I open the next one. Tap a name for a quick bio.
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
						{leadBio?.found && leadBio.extract ? (
							<p className="lead-bio">
								{leadBio.extract}{' '}
								<a href={leadBio.url} target="_blank" rel="noreferrer">
									Wikipedia ↗
								</a>
							</p>
						) : null}
					</div>
				</div>
			) : null}

			<div className="cols">
				<div className="col">
					<h3>Most-heard narrators</h3>
					<Ranked items={stats.topNarrators.slice(0, 8)} max={max} people={people} onBio={setBio} />
				</div>
				<div className="col">
					<h3>Most-read authors</h3>
					<Ranked
						items={stats.topAuthors.slice(0, 8)}
						max={stats.topAuthors[0]?.count ?? 1}
						people={people}
						onBio={setBio}
					/>
				</div>
			</div>

			{bio ? (
				<div className="modal" role="dialog" aria-modal="true" aria-label={bio.name}>
					<button
						type="button"
						className="modal-backdrop"
						aria-label="Close"
						onClick={() => setBio(null)}
					/>
					<div className="modal-panel">
						<div className="modal-head">
							<h3>{bio.name}</h3>
							<button
								type="button"
								className="modal-close"
								aria-label="Close"
								onClick={() => setBio(null)}
							>
								×
							</button>
						</div>
						<p className="modal-bio">{bio.extract}</p>
						<a className="modal-link" href={bio.url} target="_blank" rel="noreferrer">
							Read more on Wikipedia ↗
						</a>
					</div>
				</div>
			) : null}
		</section>
	);
}

function Ranked({
	items,
	max,
	people,
	onBio,
}: {
	items: { name: string; count: number }[];
	max: number;
	people: People;
	onBio: (b: Bio) => void;
}) {
	return (
		<div className="rank">
			{items.map((it, idx) => {
				const p = people[it.name];
				const hasBio = p?.found && !!p.extract;
				const inner = (
					<>
						<span className="i">{idx + 1}</span>
						<span className="name">{it.name}</span>
						<span className="bar" aria-hidden="true">
							<i style={{ width: `${(it.count / max) * 100}%` }} />
						</span>
						<span className="c">{it.count}</span>
					</>
				);
				return hasBio ? (
					<button
						type="button"
						className="rank-row rank-btn"
						key={it.name}
						onClick={() => onBio({ name: it.name, extract: p.extract ?? '', url: p.url ?? '#' })}
					>
						{inner}
					</button>
				) : (
					<div className="rank-row" key={it.name}>
						{inner}
					</div>
				);
			})}
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

// ── Fun facts (for scale) ─────────────────────────────────────────────────────
function FunFacts({ stats }: { stats: Stats }) {
	const t = stats.totals;
	const roadTrips = Math.round(t.finishedHours / 45); // ~45h to drive coast-to-coast
	const daysNonstop = Math.round(t.finishedHours / 24);
	const longest = stats.longest[0];
	const busiest = stats.busiestMonth;

	const facts: { emoji: string; big: string; label: string }[] = [
		{ emoji: '🚗', big: `${roadTrips}×`, label: 'coast-to-coast road trips of listening' },
		{ emoji: '🌙', big: `${daysNonstop}`, label: 'full days, if played back to back' },
		{ emoji: '🎙', big: `${t.narrators}`, label: 'different narrators in my ears' },
		{ emoji: '✍️', big: `${t.authors}`, label: 'authors read' },
	];
	if (busiest) {
		facts.push({
			emoji: '🔥',
			big: `${busiest.count}`,
			label: `books in my busiest month (${shortMonth(busiest.ym)})`,
		});
	}
	if (longest) {
		facts.push({
			emoji: '⏳',
			big: hours(longest.runtimeMin),
			label: `longest single listen — ${longest.title}`,
		});
	}

	return (
		<section className="section" aria-labelledby="scale">
			<p className="section-label">For scale</p>
			<h2 id="scale">The numbers, for fun</h2>
			<div className="funfacts">
				{facts.map((f) => (
					<div className="fun" key={f.label}>
						<div className="fun-big">
							<span className="fun-emoji" aria-hidden="true">
								{f.emoji}
							</span>
							{f.big}
						</div>
						<div className="fun-label">{f.label}</div>
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
