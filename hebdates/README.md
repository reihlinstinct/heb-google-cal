# hebdates (prototype, local demo)

Keep one YAML file of people and events with their original **Gregorian** date. The tool converts each to a Hebrew date and prints (or exports as .ics) the Gregorian date on which the event falls in a chosen year.

## YAML

```yaml
rules:                              # required, no silent defaults
  adar_in_leap_year: adar_ii        # adar_i | adar_ii
  day_30_in_short_month: day_29     # day_29 | first_of_next_month
dates:
  - date: "2003-07-22"              # original Gregorian date, written once
    events:                         # everything that happened on it
      - { type: birthday, person: אלון, evening: false }
      - { type: birthday, person: שירה, evening: true }   # after sunset => next Hebrew day
  - date: "2008-04-21"
    events:
      - { type: anniversary, people: [הדר, עומר], evening: true }   # both partners, one event
```

Optional `title:` on an event replaces the generated title (e.g. `title: "יום הולדת לאלון"`).

## Use

```
npm ci
node src/cli.mjs examples/events.yaml 2026          # text
node src/cli.mjs examples/events.yaml 2026 ics > 2026.ics
npm test
```

## Behavior

- A Gregorian date plus `evening` gives the Hebrew date; evening moves it one Hebrew day later.
- An anniversary lists both partners in one event, titled with the names in Hebrew alphabetical order, e.g. `יום נישואין עומר והדר`. Different couples on the same date stay separate events; there is no automatic merging. Exact duplicate events are an error.
- Rules for ambiguous Hebrew dates (Adar in leap years, day 30 in a 29-day month) must be stated in the file. A note is attached to each event where a rule applied.
- Events are all-day, on the Gregorian day of the Hebrew date. The observance itself begins the evening before.
- Calendar math is implemented in `src/hebrew.mjs` and tested against Node's built-in Hebrew calendar (`Intl`) for every day from 1900 to 2100. No runtime dependency except `js-yaml`.

## Not done / open

- Hebrew-date arithmetic is not location-aware (no sunset times): `evening` is the user's own flag.
- Which Adar rule fits memorials vs birthdays is a custom (minhag) question, so it is left to the file.
- Partner names are plain strings; two people with the same name are not distinguished (an id field could be added).
