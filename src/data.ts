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

export type EarshotData = { books: Book[]; stats: Stats; people: People };

export async function loadData(): Promise<EarshotData> {
	const base = import.meta.env.BASE_URL;
	const [books, stats, people] = await Promise.all([
		fetch(`${base}data/library.json`).then((r) => r.json() as Promise<Book[]>),
		fetch(`${base}data/stats.json`).then((r) => r.json() as Promise<Stats>),
		// people.json is optional (enrichment may not have run) — default to empty.
		fetch(`${base}data/people.json`)
			.then((r) => (r.ok ? (r.json() as Promise<People>) : {}))
			.catch(() => ({}) as People),
	]);
	return { books, stats, people };
}
