import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App, spineGenre } from './App.js';
import type { Book } from './data.js';
import { hm, hours, names, num, shortMonth } from './format.js';

const book = (genres: string[]): Book =>
	({ title: 't', authors: [], narrators: [], series: [], genres }) as unknown as Book;

describe('format helpers', () => {
	it('formats numbers with separators', () => {
		expect(num(1284)).toBe('1,284');
	});
	it('formats runtime as h/m', () => {
		expect(hm(649)).toBe('10h 49m');
		expect(hm(45)).toBe('45m');
		expect(hm(null)).toBe('—');
	});
	it('rounds to whole hours', () => {
		expect(hours(649)).toBe('11h');
	});
	it('joins names with an ampersand', () => {
		expect(names(['A'])).toBe('A');
		expect(names(['A', 'B'])).toBe('A & B');
		expect(names(['A', 'B', 'C'])).toBe('A, B & C');
	});
	it('renders a compact month label', () => {
		expect(shortMonth('2026-08')).toBe('Aug ’26');
	});
});

describe('spineGenre (shelf colouring)', () => {
	it('picks the most specific genre we have a colour for', () => {
		expect(spineGenre(book(['Literature & Fiction', 'Science Fiction & Fantasy']))).toBe(
			'Science Fiction & Fantasy',
		);
	});
	it('falls back to Other when no genre is colour-mapped', () => {
		expect(spineGenre(book(['Cooking, Food & Wine']))).toBe('Other');
		expect(spineGenre(book([]))).toBe('Other');
	});
});

describe('App', () => {
	it('renders a loading state before data arrives', () => {
		render(<App />);
		expect(screen.getByText(/Cueing up the tape/)).toBeDefined();
	});
});
