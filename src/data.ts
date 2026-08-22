export type SeriesRef = { title: string; sequence: string | null };

export type Rating = {
	overall: number | null;
	narration: number | null;
	story: number | null;
	count: number | null;
};

export type Book = {
	asin: string;
	title: string;
	subtitle: string | null;
	authors: string[];
	narrators: string[];
	series: SeriesRef[];
	genres: string[];
	language: string | null;
	contentType: string | null;
	runtimeMin: number | null;
	releaseDate: string | null;
	purchaseDate: string | null;
	finished: boolean;
	percentComplete: number;
	finishedAt: string | null;
	rating: Rating;
	coverUrl: string | null;
	audibleUrl: string | null;
};

export type Stats = {
	totals: {
		library: number;
		finished: number;
		inProgress: number;
		notStarted: number;
		finishedHours: number;
		libraryHours: number;
		libraryDays: number;
		narrators: number;
		authors: number;
		seriesStarted: number;
	};
	busiestMonth: { ym: string; count: number } | null;
	span: { first: string | null; last: string | null };
	topNarrators: { name: string; count: number }[];
	topAuthors: { name: string; count: number }[];
	topGenres: { name: string; count: number }[];
	series: { title: string; owned: number; finished: number }[];
	byMonth: Record<string, number>;
	longest: {
		title: string;
		runtimeMin: number;
		authors?: string[];
		narrators?: string[];
		coverUrl?: string | null;
	}[];
};

export type Person = { found: boolean; extract?: string; url?: string; wikiTitle?: string };
export type People = Record<string, Person>;

/** Author → country of citizenship, for the "Around the world" map. */
export type GeoEntry = {
	found: boolean;
	country?: string;
	iso?: string;
	lat?: number | null;
	lon?: number | null;
};
export type Geo = Record<string, GeoEntry>;

/** An Audible listening badge (achievement). */
export type Badge = {
	id: string;
	description: string;
	tier: 'original' | 'silver' | 'gold' | 'master' | null;
	earnedAt: string | null;
	reward: string | null;
	next: string | null;
	percentToNext: number | null;
};

export type EarshotData = {
	books: Book[];
	stats: Stats;
	people: People;
	geo: Geo;
	badges: Badge[];
};

export async function loadData(): Promise<EarshotData> {
	const base = import.meta.env.BASE_URL;
	const [books, stats, people, geo, badges] = await Promise.all([
		fetch(`${base}data/library.json`).then((r) => r.json() as Promise<Book[]>),
		fetch(`${base}data/stats.json`).then((r) => r.json() as Promise<Stats>),
		// people.json is optional (enrichment may not have run) — default to empty.
		fetch(`${base}data/people.json`)
			.then((r) => (r.ok ? (r.json() as Promise<People>) : {}))
			.catch(() => ({}) as People),
		// geo.json is optional (author→country enrichment may not have run).
		fetch(`${base}data/geo.json`)
			.then((r) => (r.ok ? (r.json() as Promise<Geo>) : {}))
			.catch(() => ({}) as Geo),
		// badges.json is optional (badge pull may not have run).
		fetch(`${base}data/badges.json`)
			.then((r) => (r.ok ? (r.json() as Promise<Badge[]>) : []))
			.catch(() => [] as Badge[]),
	]);
	return { books, stats, people, geo, badges };
}
