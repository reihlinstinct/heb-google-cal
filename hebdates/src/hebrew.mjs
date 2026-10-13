// Pure Hebrew calendar arithmetic (Dershowitz & Reingold, "Calendrical Calculations").
// Month numbers: Nisan=1 ... Elul=6, Tishrei=7, Cheshvan=8, Kislev=9, Tevet=10,
// Shevat=11, Adar=12 (Adar I in a leap year), Adar II=13 (leap years only).
const EPOCH = -1373427; // R.D. of 1 Tishrei, year 1
const RD_UNIX = 719163; // R.D. of 1970-01-01

export const isLeap = (y) => (7 * y + 1) % 19 < 7;
export const lastMonth = (y) => (isLeap(y) ? 13 : 12);

function delay1(y) {
  const months = Math.floor((235 * y - 234) / 19);
  const parts = 12084 + 13753 * months;
  const day = 29 * months + Math.floor(parts / 25920);
  return (3 * (day + 1)) % 7 < 3 ? day + 1 : day;
}
function delay2(y) {
  const last = delay1(y - 1), present = delay1(y), next = delay1(y + 1);
  if (next - present === 356) return 2;
  if (present - last === 382) return 1;
  return 0;
}
export const newYear = (y) => EPOCH + delay1(y) + delay2(y);
export const daysInYear = (y) => newYear(y + 1) - newYear(y);

export function daysInMonth(y, m) {
  if (m === 2 || m === 4 || m === 6 || m === 10 || m === 13) return 29;
  if (m === 12 && !isLeap(y)) return 29;
  if (m === 8 && daysInYear(y) % 10 !== 5) return 29;
  if (m === 9 && daysInYear(y) % 10 === 3) return 29;
  return 30;
}

export function fixedFromHebrew({ year, month, day }) {
  let total = newYear(year) + day - 1;
  const last = lastMonth(year);
  if (month < 7) {
    for (let m = 7; m <= last; m++) total += daysInMonth(year, m);
    for (let m = 1; m < month; m++) total += daysInMonth(year, m);
  } else {
    for (let m = 7; m < month; m++) total += daysInMonth(year, m);
  }
  return total;
}

export function hebrewFromFixed(date) {
  let year = Math.floor((date - EPOCH) / 365.2468) + 1;
  while (newYear(year + 1) <= date) year++;
  while (newYear(year) > date) year--;
  const order = [];
  const last = lastMonth(year);
  for (let m = 7; m <= last; m++) order.push(m);
  for (let m = 1; m <= 6; m++) order.push(m);
  let rest = date - newYear(year);
  for (const month of order) {
    const len = daysInMonth(year, month);
    if (rest < len) return { year, month, day: rest + 1 };
    rest -= len;
  }
  throw new Error('unreachable');
}

export const fixedFromGregorian = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / 86400000) + RD_UNIX;
export function gregorianFromFixed(fixed) {
  const dt = new Date((fixed - RD_UNIX) * 86400000);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}
export const isoFromFixed = (f) => {
  const g = gregorianFromFixed(f);
  return `${String(g.year).padStart(4, '0')}-${String(g.month).padStart(2, '0')}-${String(g.day).padStart(2, '0')}`;
};

const NAMES = { 1: 'ניסן', 2: 'אייר', 3: 'סיוון', 4: 'תמוז', 5: 'אב', 6: 'אלול', 7: 'תשרי', 8: 'חשוון', 9: 'כסלו', 10: 'טבת', 11: 'שבט' };
export function monthName(year, month) {
  if (month === 12) return isLeap(year) ? 'אדר א׳' : 'אדר';
  if (month === 13) return 'אדר ב׳';
  return NAMES[month];
}
export const formatHebrew = ({ year, month, day }) => `${day} ${monthName(year, month)} ${year}`;
