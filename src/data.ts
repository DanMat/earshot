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
	};
	span: { first: string | null; last: string | null };
	topNarrators: { name: string; count: number }[];
	topAuthors: { name: string; count: number }[];
	topGenres: { name: string; count: number }[];
	series: { title: string; owned: number; finished: number }[];
	byMonth: Record<string, number>;
	longest: { title: string; runtimeMin: number }[];
};

export type EarshotData = { books: Book[]; stats: Stats };

export async function loadData(): Promise<EarshotData> {
	const [books, stats] = await Promise.all([
		fetch(`${import.meta.env.BASE_URL}data/library.json`).then((r) => r.json() as Promise<Book[]>),
		fetch(`${import.meta.env.BASE_URL}data/stats.json`).then((r) => r.json() as Promise<Stats>),
	]);
	return { books, stats };
}
