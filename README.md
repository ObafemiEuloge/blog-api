# Junior Technical Tests — Blog app (Parse)

One shared domain (**users, posts, comments, likes**), three profiles, **3 hours max** each.

|Profile|Brief|Send to the candidate|
|---|---|---|
|Frontend|[frontend-react.md](frontend-react.md)|the brief + `dev-server/` (without `node_modules`)|
|Mobile|[mobile-react-native.md](mobile-react-native.md)|the brief + `dev-server/` (without `node_modules`)|
|Backend|[backend-nodejs.md](backend-nodejs.md)|the brief **only**|

Internal, never sent: [GRADING.md](GRADING.md). `dev-server/server.mjs` is the reference solution of the backend test.

## Contents

```plaintext
README.md                 this file (internal)
GRADING.md                scoring grids + debrief questions (internal)
frontend-react.md         candidate brief — React + Vite + Parse JS SDK
mobile-react-native.md    candidate brief — Expo + Parse JS SDK
backend-nodejs.md         candidate brief — Express + Parse Server + Cloud Code
dev-server/
  server.mjs              ready-to-run Parse Server (in-memory Mongo, schema, CLPs, Cloud Code, seed data)
  check-api.mjs           black-box REST checker (31 checks) used to grade backend candidates
```

## Process

1. Before sending: set the "Generative AI: allowed / forbidden" line in the brief.
2. Send the files listed above with a start time; the candidate returns a Git repo within **3h**.
3. Grade with [GRADING.md](GRADING.md) (≈ 30 min), then a 15-min debrief.

## Dev server (sanity check)

```bash
cd dev-server && npm install && npm start     # http://localhost:1337/parse, appId blog-app
node check-api.mjs                            # in another terminal → "All checks passed"
```

Seed users: `alice`, `bob`, `carol` / `Password123!` — 25 posts with comments and likes. Data resets on restart (set `DATABASE_URI` to persist). Verified with Node 24, parse-server 9.10, parse 8.6 (Vite 8 build and Expo SDK 58 Android bundle).
