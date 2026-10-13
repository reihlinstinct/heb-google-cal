import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixedFromGregorian, fixedFromHebrew, gregorianFromFixed, daysInMonth } from '../src/hebrew.mjs';
import { parseConfig, buildYear, toIcs } from '../src/engine.mjs';

const RULES = 'rules:\n  adar_in_leap_year: adar_ii\n  day_30_in_short_month: day_29\n';
// ev: list of [date, '{flow event}'] pairs
const cfg = (pairs, rules = RULES) => parseConfig(rules + 'dates:\n' + pairs.map(([d, evs]) => `  - date: "${d}"\n    events:\n` + evs.map((e) => `      - ${e}\n`).join('')).join(''));

test('evening flag moves the Hebrew date one day later', () => {
  const r = buildYear(cfg([['2003-07-22', ['{person: A, type: birthday, evening: false}', '{person: B, type: birthday, evening: true}']]]), 2026);
  assert.deepEqual(r.events.map((e) => [e.people[0], e.date, e.hebrew]), [['A', '2026-07-07', '22 תמוז 5786'], ['B', '2026-07-08', '23 תמוז 5786']]);
});

test('an anniversary is one event for the couple, names in Hebrew alphabetical order', () => {
  const r = buildYear(cfg([['2008-04-21', ['{people: [הדר, עומר], type: anniversary, evening: true}']]]), 2026);
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].title, 'יום נישואין הדר ועומר');
});

test('two different couples with the same date and evening are NOT merged', () => {
  const r = buildYear(cfg([['2008-04-21', ['{people: [הדר, עומר], type: anniversary, evening: true}', '{people: [טל, ספיר], type: anniversary, evening: true}']]]), 2026);
  assert.deepEqual(r.events.map((e) => e.title).sort(), ['יום נישואין הדר ועומר', 'יום נישואין טל וספיר'].sort());
  assert.equal(r.events[0].date, r.events[1].date);
});

test('identical duplicate event is an error; anniversary needs two partners', () => {
  assert.throws(() => cfg([['2008-04-21', ['{people: [A, B], type: anniversary, evening: true}', '{people: [B, A], type: anniversary, evening: true}']]]), /duplicates/);
  assert.throws(() => cfg([['2008-04-21', ['{person: A, type: anniversary, evening: true}']]]), /both partners/);
});

test('same date can hold a daytime and an evening event', () => {
  const r = buildYear(cfg([['2003-07-22', ['{person: A, type: memorial, evening: false}', '{person: A, type: memorial, evening: true}']]]), 2026);
  assert.equal(r.events.length, 2);
});

test('missing evening flag is an error, no silent default', () => {
  assert.throws(() => cfg([['2003-07-22', ['{person: A, type: birthday}']]]), /evening/);
});

test('missing rules are an error', () => {
  const ev = [['2003-07-22', ['{person: A, type: birthday, evening: false}']]];
  assert.throws(() => parseConfig('dates:\n  - {date: "2003-07-22", events: [{person: A, type: birthday, evening: false}]}\n'), /rules/);
  assert.throws(() => cfg(ev, 'rules:\n  adar_in_leap_year: adar_ii\n'), /day_30/);
});

test('rejects bad dates, unknown types, multi-person birthdays', () => {
  assert.throws(() => cfg([['2003-02-30', ['{person: A, type: birthday, evening: false}']]]), /real calendar date/);
  assert.throws(() => cfg([['2003-02-03', ['{person: A, type: party, evening: false}']]]), /type must be/);
  assert.throws(() => cfg([['2003-02-03', ['{people: [A, B], type: birthday, evening: false}']]]), /only anniversaries/);
});

test('Adar in a non-leap origin year follows the explicit leap-year rule', () => {
  const ev = [['2009-03-12', ['{person: D, type: memorial, evening: false}']]];
  const ii = buildYear(cfg(ev), 2024).events[0];
  assert.match(ii.hebrew, /אדר ב׳ 5784/);
  const i = buildYear(cfg(ev, RULES.replace('adar_ii', 'adar_i')), 2024).events[0];
  assert.match(i.hebrew, /אדר א׳ 5784/);
  assert.notEqual(ii.date, i.date);
  assert.ok(ii.notes.length > 0);
});

test('day 30 of Kislev in a year where Kislev has 29 days follows the explicit rule', () => {
  const longY = [5770, 5771, 5772, 5773, 5774, 5775, 5776, 5777, 5778].find((y) => daysInMonth(y, 9) === 30);
  const shortY = [5779, 5780, 5781, 5782, 5783, 5784, 5785, 5786].find((y) => daysInMonth(y, 9) === 29);
  const g = gregorianFromFixed(fixedFromHebrew({ year: longY, month: 9, day: 30 }));
  const iso = `${g.year}-${String(g.month).padStart(2, '0')}-${String(g.day).padStart(2, '0')}`;
  const ev = [[iso, ['{person: K, type: memorial, evening: false}']]];
  const day29 = buildYear(cfg(ev), shortY - 3761).events[0];
  const next = buildYear(cfg(ev, RULES.replace('day_29', 'first_of_next_month')), shortY - 3761).events[0];
  assert.match(day29.hebrew, /^29 כסלו/);
  assert.match(next.hebrew, /^1 טבת/);
  assert.equal(fixedFromGregorian(+next.date.slice(0, 4), +next.date.slice(5, 7), +next.date.slice(8)) - fixedFromGregorian(+day29.date.slice(0, 4), +day29.date.slice(5, 7), +day29.date.slice(8)), 1);
  assert.ok(day29.notes.length > 0);
});

test('output is the occurrence inside the requested Gregorian year', () => {
  const r = buildYear(cfg([['2003-07-22', ['{person: A, type: birthday, evening: false}']]]), 2030);
  assert.ok(r.events.every((e) => e.date.startsWith('2030')));
});

test('ICS: all-day events, escaped text, example file builds', () => {
  const c = parseConfig(fs.readFileSync(new URL('../examples/events.yaml', import.meta.url), 'utf8'));
  const ics = toIcs(buildYear(c, 2026).events, 2026);
  assert.match(ics, /DTSTART;VALUE=DATE:20260707/);
  assert.match(ics, /BEGIN:VCALENDAR/);
});

test('Adar and day-30 policies can differ per event type (explicit map, all types required)', () => {
  const rules = 'rules:\n  adar_in_leap_year: {birthday: adar_ii, memorial: adar_i, anniversary: adar_ii}\n  day_30_in_short_month: day_29\n';
  const ev = [['2009-03-12', ['{person: B, type: birthday, evening: false}', '{person: M, type: memorial, evening: false}']]];
  const r = buildYear(cfg(ev, rules), 2024).events;
  const b = r.find((e) => e.type === 'birthday'), m = r.find((e) => e.type === 'memorial');
  assert.match(b.hebrew, /אדר ב׳/);
  assert.match(m.hebrew, /אדר א׳/);
  assert.throws(() => cfg(ev, 'rules:\n  adar_in_leap_year: {birthday: adar_ii}\n  day_30_in_short_month: day_29\n'), /memorial/);
});

test('one conversion per distinct date; evening selects the day or the next day', async () => {
  const { convertDates } = await import('../src/engine.mjs');
  const c = cfg([['2003-07-22', ['{person: A, type: birthday, evening: false}', '{person: B, type: birthday, evening: true}']], ['2000-01-01', ['{person: C, type: memorial, evening: false}']]]);
  const m = convertDates(c.events);
  assert.equal(m.size, 2);
  const e = m.get('2003-7-22');
  assert.equal(e.evening.day, e.day.day + 1);
});

test('an explicit title overrides the generated one; an empty title is an error', () => {
  const r = buildYear(cfg([['2003-07-22', ['{person: A, type: birthday, evening: false, title: "יום הולדת לאלון"}']]]), 2026);
  assert.equal(r.events[0].title, 'יום הולדת לאלון');
  assert.throws(() => cfg([['2003-07-22', ['{person: A, type: birthday, evening: false, title: ""}']]]), /title/);
});

test('event that happened in Adar I of a leap year stays in Adar I in later leap years; Adar in a regular year goes to Adar II', () => {
  // 2024-02-15 = 6 Adar I 5784 (leap year); 2027 falls in leap year 5787
  const rules = RULES; // adar_ii
  const fromAdarI = buildYear(cfg([['2024-02-15', ['{person: A, type: birthday, evening: false}']]], rules), 2027).events[0];
  assert.match(fromAdarI.hebrew, /^6 אדר א׳ 5787/);
  const fromAdar = buildYear(cfg([['2009-03-12', ['{person: B, type: birthday, evening: false}']]], rules), 2027).events[0];
  assert.match(fromAdar.hebrew, /אדר ב׳ 5787/);
});
