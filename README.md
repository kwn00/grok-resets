# Grok Resets

Unofficial static tracker for usage-limit resets announced by [@bot](https://x.com/bot) on X.

One reset refills the Grok Bot, Grok Build, and Cursor combined plan at the same time. The page records those public announcements. It does not read anyone's account.

## Run locally

Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The dev server also writes `public/api/v1/resets.json` and `public/api/v1/status.json`.

```bash
npm test
npm run build
npm run preview
```

`npm run build` typechecks, regenerates the JSON files, and writes the site to `dist/`.

## Add a reset

Append an object to `data/resets.json`. Leave older rows in place.

```json
{
  "id": "2119871982946971659",
  "created_at_utc": "2026-11-09T19:17:20Z",
  "url": "https://x.com/bot/status/2119871982946971659",
  "text": "We've reset weekly limits for all Grok Bot users.\n\nEnjoy!"
}
```

- `id`: the post id, as a string.
- `created_at_utc`: ISO-8601 time with a timezone, usually `Z`.
- `url`: `http` or `https` link to the post.
- `text`: the original post, including line breaks.
- `type` (optional): `weekly` or `general`. When omitted, a post that mentions "weekly" is `weekly`. Anything else is `general`.
- `kst` and `notified` are ignored. Old rows may still contain them.

Then run `npm run build` (or leave `npm run dev` running). The page and the two JSON files both read this file.

Rows with a bad date, a non-http URL, or missing text are skipped.

## What the numbers mean

Durations are decimal days, rounded to one place. The page shows `—` when a number cannot be computed. The JSON uses `null` for that same case.

- **Total resets:** how many valid rows are in the file.
- **Average interval:** the mean gap between consecutive announcements. Needs at least two rows.
- **Days since last reset:** time from the newest announcement to the clock in use. The page uses the visitor's clock. `status.json` uses the clock at build time. A timestamp in the future counts as `0`. Zero rows makes this `null`.
- The latest card and each announcement show the same instant twice: once in UTC, and once in the visitor's timezone (`UTC+09:00`, `UTC-08:00`, and so on).
- **Longest wait:** the largest gap between consecutive announcements. Needs at least two rows.

The heatmap is 26 weeks of UTC days, Monday through Sunday, ending on the current week. Brighter cells had more announcements that day.

## JSON

Generated at build into `dist/api/v1/`:

- `/api/v1/resets.json` — newest first, with `id`, `created_at`, `url`, `text`, and `type`.
- `/api/v1/status.json` — totals, intervals, and the latest row.

Both include `generated_at` and `version`.

## Deploy on Vercel

Import the repository and use:

| Setting | Value |
| --- | --- |
| Framework | Vite (or static) |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js | 22.x or newer |
| Environment variables | none |

`vercel.json` already sets the framework, build command, and output directory. No server, no database.

## Disclaimer

Independent tracker. Not affiliated with Grok Bot, SpaceXAI, X, or Cursor. Data is taken from public posts by @bot.
