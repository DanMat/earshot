import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { hm, hours, names, num, shortMonth } from './format.js';

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

describe('App', () => {
	it('renders a loading state before data arrives', () => {
		render(<App />);
		expect(screen.getByText(/Cueing up the tape/)).toBeDefined();
	});
});
