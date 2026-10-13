import test from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig } from '../src/engine.mjs';

const RULES = 'rules:\n  adar_in_leap_year: adar_ii\n  day_30_in_short_month: day_29\n';
test('YAML is parsed with the safe core schema: no custom tags or code', () => {
  assert.throws(() => parseConfig(RULES + 'dates:\n  - !!js/function "function(){}"\n'));
});
test('prototype-pollution style keys do not change behavior', () => {
  const c = parseConfig(RULES + 'dates:\n  - {date: "2003-07-22", events: [{person: A, type: birthday, evening: false, __proto__: {x: 1}}]}\n');
  assert.equal({}.x, undefined);
  assert.equal(c.events.length, 1);
});
test('ICS text escaping prevents injected lines from names', async () => {
  const { toIcs } = await import('../src/engine.mjs');
  const ics = toIcs([{ title: 'x\nEND:VEVENT\nBEGIN:VEVENT', date: '2026-01-01', hebrew: 'h', originGregorian: 'o', originHebrew: 'oh', evening: false, notes: [] }], 2026);
  assert.equal((ics.match(/^BEGIN:VEVENT/gm) || []).length, 1);
});
