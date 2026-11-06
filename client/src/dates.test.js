import { expect, test } from 'vitest';
import { daysAgo, formatDate } from './dates.js';

test('formats the stored date without shifting it to UTC', () => {
  expect(formatDate('2026-11-06')).toBe('6 Nov 2026');
  expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
});

test('says how long ago in whole days', () => {
  const now = new Date(2026, 10, 6, 23, 30);
  expect(daysAgo('2026-11-06', now)).toBe('today');
  expect(daysAgo('2026-11-05', now)).toBe('yesterday');
  expect(daysAgo('2026-10-27', now)).toBe('10 days ago');
  expect(daysAgo('2026-11-08', now)).toBe('upcoming');
});
