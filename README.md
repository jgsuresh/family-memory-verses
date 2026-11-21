# Family Memory Verses

Installable web app (PWA) for learning and reviewing memory verses. Static files plus a free
Supabase database for sync between two phones. No build step.

- **Learn tab:** shared lists (Boys = Awana HoneyComb, Parents = our own). Verses are hidden by
  default, with a first-letters hint.
- **Review tab:** spaced repetition for memorized verses. Each person has their own schedule
  (Again / Hard / Good / Easy, intervals grow roughly 1d, 3d, 8d, 20d, ...). A verse enters review
  the day after it is marked Memorized.
- Works offline; changes sync when the phone is back online.

## Try it locally (no accounts)

Leave `config.js` empty and serve this folder, e.g. `python3 -m http.server 8765`, then open
http://localhost:8765. Data stays in that browser only.

## Set up sync (about 10 minutes, one time)

1. Create a free project at https://supabase.com (any name, pick a region near you, save the DB password).
2. **SQL Editor > New query**: paste `schema.sql`, replace `WIFE_EMAIL_HERE` with her email, Run.
3. **Authentication > Users > Add user** (create user, tick "Auto Confirm"): add both emails with
   passwords you will each use. Then **Authentication > Sign In / Providers > Email**: turn off
   "Allow new users to sign up" so nobody else can create accounts.
4. **Project Settings > API**: copy the Project URL and the `anon` public key into `config.js`.
5. Publish the folder to any static host (GitHub Pages, Cloudflare Pages, Netlify).
6. On each phone: open the site, sign in, then Share > Add to Home Screen (iPhone, in Safari) or
   menu > Install app (Android, in Chrome).

The anon key is public by design. The row-level rules in `schema.sql` only let the two listed
emails read or write anything, and each person can only touch their own review rows.

## Notes

- Review reminders are an in-app count (and an app-icon badge where the phone supports it). Push
  notifications would need a small server and are not included.
- Files: `app.js` (UI + sync), `srs.js` (scheduling), `seed.js` (starting verses), `sw.js` (offline).
