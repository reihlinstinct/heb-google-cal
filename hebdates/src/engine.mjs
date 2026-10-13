import * as yaml from 'js-yaml';
import { fixedFromGregorian, fixedFromHebrew, hebrewFromFixed, isLeap, daysInMonth, isoFromFixed, gregorianFromFixed, formatHebrew, monthName } from './hebrew.mjs';

export const EVENT_TYPES = ['birthday', 'memorial', 'anniversary'];
export const RULE_OPTIONS = {
  // Event in (non-leap) Adar, or day-30 of Adar I, when the target year is a leap year / lacks that day
  adar_in_leap_year: ['adar_i', 'adar_ii'],
  // Hebrew day 30 of Cheshvan/Kislev/Adar I in a year where that month has 29 days
  day_30_in_short_month: ['day_29', 'first_of_next_month'],
};
const TITLES = { birthday: 'יום הולדת', memorial: 'יום זיכרון', anniversary: 'יום נישואין' };

function fail(msg) { throw new Error(msg); }

export function parseConfig(text) {
  const doc = yaml.load(text, { schema: yaml.CORE_SCHEMA });
  if (!doc || typeof doc !== 'object') fail('empty or invalid YAML');
  const rules = doc.rules ?? fail('missing "rules": calendar rules must be stated explicitly');
  for (const [k, allowed] of Object.entries(RULE_OPTIONS)) {
    if (!(k in rules)) fail(`rules.${k} is required (one of: ${allowed.join(', ')})`);
    const v = rules[k];
    if (typeof v === 'object' && v !== null) {
      // per-event-type policy: every type must be stated, no fallback
      for (const t of EVENT_TYPES) {
        if (!allowed.includes(v[t])) fail(`rules.${k}.${t} must be one of: ${allowed.join(', ')}`);
      }
    } else if (!allowed.includes(v)) fail(`rules.${k} must be one of: ${allowed.join(', ')} (or a map with ${EVENT_TYPES.join(', ')})`);
  }
  if (!Array.isArray(doc.dates) || doc.dates.length === 0) fail('"dates" must be a non-empty list');
  const events = [];
  const seen = new Set();
  doc.dates.forEach((d, i) => {
    const at = `dates[${i}]`;
    const g = parseDate(d.date, `${at}.date`);
    if (!Array.isArray(d.events) || d.events.length === 0) fail(`${at}.events must be a non-empty list`);
    d.events.forEach((e, j) => {
      const ev = normalizeEvent(e, g, `${at}.events[${j}]`);
      const key = `${g.year}-${g.month}-${g.day}|${ev.type}|${[...ev.people].sort().join(',')}|${ev.evening}`;
      if (seen.has(key)) fail(`${at}.events[${j}] duplicates an earlier identical event`);
      seen.add(key);
      events.push(ev);
    });
  });
  return { rules, events };
}

function parseDate(value, at) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value instanceof Date ? value.toISOString().slice(0, 10) : value));
  if (!m) fail(`${at} must be an ISO date YYYY-MM-DD`);
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const back = gregorianFromFixed(fixedFromGregorian(y, mo, d));
  if (back.year !== y || back.month !== mo || back.day !== d) fail(`${at} is not a real calendar date`);
  return { year: y, month: mo, day: d };
}

function normalizeEvent(e, gregorian, at) {
  if (!EVENT_TYPES.includes(e.type)) fail(`${at}.type must be one of: ${EVENT_TYPES.join(', ')}`);
  const people = [].concat(e.people ?? e.person ?? []).map(String);
  if (people.length === 0) fail(`${at}: "person" or "people" is required`);
  if (new Set(people).size !== people.length) fail(`${at}: a person is listed twice`);
  if (e.type === 'anniversary' && people.length < 2) fail(`${at}: an anniversary lists both partners in "people" (one event per couple)`);
  if (e.type !== 'anniversary' && people.length > 1) fail(`${at}: only anniversaries may list several people`);
  if (typeof e.evening !== 'boolean') fail(`${at}.evening must be true or false (did it happen after sunset?); there is no default`);
  if (e.title !== undefined && (typeof e.title !== 'string' || e.title.trim() === '')) fail(`${at}.title must be a non-empty string when given`);
  return { type: e.type, people, gregorian, evening: e.evening, title: e.title };
}

/** Hebrew date the event belongs to: after sunset counts as the next Hebrew day. */
const dateKey = (g) => `${g.year}-${g.month}-${g.day}`;
/** Convert each distinct Gregorian date once; the evening flag only selects the day or the next day. */
export function convertDates(events) {
  const byDate = new Map();
  for (const ev of events) {
    const k = dateKey(ev.gregorian);
    if (!byDate.has(k)) {
      const f = fixedFromGregorian(ev.gregorian.year, ev.gregorian.month, ev.gregorian.day);
      byDate.set(k, { day: hebrewFromFixed(f), evening: hebrewFromFixed(f + 1) });
    }
  }
  return byDate;
}
export const originHebrew = (ev, byDate = convertDates([ev])) => byDate.get(dateKey(ev.gregorian))[ev.evening ? 'evening' : 'day'];

/** Resolve the origin Hebrew date into a concrete date in Hebrew year `hy`, applying explicit rules. */
export const ruleFor = (rules, name, type) => (typeof rules[name] === 'object' ? rules[name][type] : rules[name]);

export function occurrenceInHebrewYear(origin, hy, rules, notes = [], type) {
  const adarRule = ruleFor(rules, 'adar_in_leap_year', type);
  const day30Rule = ruleFor(rules, 'day_30_in_short_month', type);
  let month = origin.month, day = origin.day;
  const originLeap = isLeap(origin.year);
  const targetLeap = isLeap(hy);
  if (month === 12 && !originLeap && targetLeap) {
    month = adarRule === 'adar_i' ? 12 : 13;
    notes.push(`אדר בשנה פשוטה, בשנה מעוברת לפי הכלל ${adarRule === 'adar_i' ? 'אדר א׳' : 'אדר ב׳'}`);
  } else if ((month === 12 || month === 13) && originLeap && !targetLeap) {
    month = 12;
    notes.push('אדר א׳/ב׳ בשנה מעוברת מוצג באדר בשנה פשוטה');
  }
  const len = daysInMonth(hy, month);
  if (day > len) {
    if (day30Rule === 'day_29') {
      day = len;
      notes.push(`בחודש ${monthName(hy, month)} אין יום 30, לפי הכלל נקבע יום ${len}`);
    } else {
      const next = month === 8 ? 9 : month === 9 ? 10 : month === 12 && isLeap(hy) ? 13 : 1;
      notes.push(`בחודש ${monthName(hy, month)} אין יום 30, לפי הכלל נקבע 1 ב${monthName(hy, next)}`);
      month = next; day = 1;
    }
  }
  return { hebrew: { year: hy, month, day }, notes };
}

export function titleFor(ev) {
  if (ev.title) return ev.title; // explicit display title wins over the generated one
  const names = [...ev.people].sort((a, b) => a.localeCompare(b, 'he'));
  return `${TITLES[ev.type]} ${names.join(' ו')}`;
}

/** Build the calendar for a Gregorian target year. */
export function buildYear(config, targetYear) {
  const events = config.events;
  const byDate = convertDates(events);
  const out = [];
  for (const ev of events) {
    const origin = originHebrew(ev, byDate);
    for (const hy of [targetYear + 3760, targetYear + 3761]) {
      const notes = [];
      const { hebrew } = occurrenceInHebrewYear(origin, hy, config.rules, notes, ev.type);
      const fixed = fixedFromHebrew(hebrew);
      const g = gregorianFromFixed(fixed);
      if (g.year !== targetYear) continue;
      out.push({
        title: titleFor(ev), type: ev.type, people: [...ev.people].sort((a, b) => a.localeCompare(b, 'he')),
        date: isoFromFixed(fixed), hebrew: formatHebrew(hebrew), originHebrew: formatHebrew(origin),
        originGregorian: `${ev.gregorian.year}-${String(ev.gregorian.month).padStart(2, '0')}-${String(ev.gregorian.day).padStart(2, '0')}`,
        evening: ev.evening, hebrewYearsSinceOrigin: hy - origin.year, notes,
      });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'he'));
  return { events: out };
}

export function toIcs(events, targetYear) {
  const esc = (s) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//hebdates demo//EN', 'CALSCALE:GREGORIAN'];
  events.forEach((e, i) => {
    const d = e.date.replaceAll('-', '');
    const end = isoFromFixed(fixedFromGregorian(+e.date.slice(0, 4), +e.date.slice(5, 7), +e.date.slice(8, 10)) + 1).replaceAll('-', '');
    const desc = [`תאריך עברי: ${e.hebrew}`, `מקור: ${e.originGregorian}${e.evening ? ' (בערב)' : ''} = ${e.originHebrew}`, 'האירוע מתחיל בערב שלפני התאריך הלועזי המסומן', ...e.notes].join('\n');
    lines.push('BEGIN:VEVENT', `UID:hebdates-${targetYear}-${i}@example.invalid`, `DTSTAMP:${targetYear}0101T000000Z`,
      `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(desc)}`, 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
