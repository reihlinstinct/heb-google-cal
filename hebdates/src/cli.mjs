#!/usr/bin/env node
import fs from 'node:fs';
import { parseConfig, buildYear, toIcs } from './engine.mjs';
const [file, yearArg, fmt = 'text'] = process.argv.slice(2);
if (!file || !yearArg) { console.error('usage: cli.mjs events.yaml YEAR [text|json|ics]'); process.exit(2); }
try {
  const cfg = parseConfig(fs.readFileSync(file, 'utf8'));
  const res = buildYear(cfg, Number(yearArg));
  if (fmt === 'json') console.log(JSON.stringify(res, null, 2));
  else if (fmt === 'ics') process.stdout.write(toIcs(res.events, Number(yearArg)));
  else {
    for (const e of res.events) console.log(`${e.date}  ${e.title}  [${e.hebrew}; מקור ${e.originGregorian}${e.evening ? ' בערב' : ''} = ${e.originHebrew}]${e.notes.length ? '  * ' + e.notes.join('; ') : ''}`);
  }
} catch (err) { console.error('error:', err.message); process.exit(1); }
