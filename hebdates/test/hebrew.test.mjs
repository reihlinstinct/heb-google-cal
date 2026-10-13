import test from 'node:test';
import assert from 'node:assert/strict';
import { fixedFromGregorian, hebrewFromFixed, fixedFromHebrew, isLeap, daysInYear } from '../src/hebrew.mjs';

const fmt = new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const MONTH = { Nisan: 1, Iyar: 2, Sivan: 3, Tamuz: 4, Av: 5, Elul: 6, Tishri: 7, Heshvan: 8, Kislev: 9, Tevet: 10, Shevat: 11, 'Adar I': 12, 'Adar II': 13 };

test('matches the platform Intl Hebrew calendar for every day 1900-2100', () => {
  const start = Date.UTC(1900, 0, 1), end = Date.UTC(2100, 11, 31);
  for (let t = start; t <= end; t += 86400000) {
    const dt = new Date(t);
    const p = Object.fromEntries(fmt.formatToParts(dt).map((x) => [x.type, x.value]));
    let month = MONTH[p.month];
    if (p.month === 'Adar') month = 12; // non-leap year Adar
    const exp = { year: +p.year, month, day: +p.day };
    const got = hebrewFromFixed(fixedFromGregorian(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()));
    assert.deepEqual(got, exp, dt.toISOString());
  }
});

test('round trip and year lengths', () => {
  for (let f = fixedFromGregorian(1950, 1, 1); f < fixedFromGregorian(2100, 1, 1); f += 7) {
    assert.equal(fixedFromHebrew(hebrewFromFixed(f)), f);
  }
  for (let y = 5700; y < 5900; y++) assert.ok([353, 354, 355, 383, 384, 385].includes(daysInYear(y)), String(y));
});

test('known dates', () => {
  assert.deepEqual(hebrewFromFixed(fixedFromGregorian(2003, 7, 22)), { year: 5763, month: 4, day: 22 });
  assert.equal(isLeap(5784), true);
  assert.equal(isLeap(5785), false);
});
