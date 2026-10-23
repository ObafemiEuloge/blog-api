# Blog API — Express + Parse Server + Cloud Code

A REST API for a small blog (users, posts, comments, likes) built on
[Parse Server](https://docs.parseplatform.org/parse-server/guide/) mounted on Express.
All business rules live in Cloud Code (`cloud/`).

## Quick start

Requirements: Node.js 20.19+, 22.13+ or 24.11+ (the versions supported by parse-server 9).

```bash
cp .env.example .env        # then set PARSE_MASTER_KEY (e.g. `openssl rand -hex 32`)
npm install
npm start                   # http://localhost:1337/parse
```

```bash
curl http://localhost:1337/parse/health
# {"status":"ok"}
```

Without `DATABASE_URI`, the server starts an **in-memory MongoDB** (`mongodb-memory-server`),
so no database needs to be installed. The first run downloads a MongoDB binary (internet
access needed once, then cached). Data is lost on restart: set `DATABASE_URI` to persist it.

| Variable | Required | Description |
|---|---|---|
| `PARSE_MASTER_KEY` | yes | Master key. Never hard-coded, never logged. |
| `DATABASE_URI` | no | MongoDB URI, e.g. `mongodb://localhost:27017/blog-app`. Empty = in-memory MongoDB. |
| `PORT` | no | HTTP port, `1337` by default. |
| `LOG_LEVEL` | no | Parse Server log level (`info` by default, `silent` to mute). |

Other ways to run it:

```bash
docker run -p 27017:27017 mongo:7      # local MongoDB, then DATABASE_URI=mongodb://localhost:27017/blog-app
docker compose up --build              # MongoDB + API (reads PARSE_MASTER_KEY from .env)
npm run seed                           # demo data (alice, bob, carol / Password123!) on a running server
```

## Tests

```bash
npm test     # node:test, exit code 0 when everything passes
npm run lint
```

23 tests in `tests/`. Each test file starts a real server on a free port with an in-memory
MongoDB, and talks to it **over REST only**, the same way a black-box client would:

| File | Covers |
|---|---|
| `tests/posts.test.js` | R2 trimming and length rules, R3 server-owned fields on create and update, CLP and ACL on posts |
| `tests/comments.test.js` | R4 validation, missing post (101), forced author and ACL, R5 `commentsCount`, R6 cascade delete |
| `tests/likes.test.js` | R7 like/unlike and `likesCount`, login required (142), unknown post (101), no direct client writes on `Like`, parallel calls |
| `tests/server.test.js` | health check, R1 schema created by code, no client class/field creation, email privacy, `userStats` |

## What is done

| # | Rule | Where |
|---|---|---|
| R1 | Classes, fields and CLPs created by code at startup; schema locked | `src/schema.js` (Parse Server `schema` option) |
| R2 | Title 3–120 and body 1–5000 characters, after trimming | `cloud/triggers/post.js` |
| R3 | Author, counters and ACL set by the server; client values ignored; not changeable on update | `cloud/triggers/post.js` |
| R4 | Comment text 1–500, post must exist (101), author forced, ACL | `cloud/triggers/comment.js` |
| R5 | `commentsCount` kept in sync on comment create and delete | `cloud/triggers/comment.js` |
| R6 | Deleting a post deletes its comments and likes | `cloud/triggers/post.js` |
| R7 | `toggleLike({ postId })` → `{ liked, likesCount }` | `cloud/functions/toggle-like.js` |
| R8 | 23 automated tests | `tests/` |

Server options: `allowClientClassCreation: false`, `enforcePrivateUsers: false` (users are
publicly readable so posts can `include` their author) and `email` as a protected field of
`_User` (a user still sees their own email).

**Bonus, all done:**

- `toggleLike` is consistent under parallel calls: unique index on `Like (post, user)`
  (`src/indexes.js`) and atomic counter updates.
- Cloud function `userStats({ userId })` → `{ posts, comments, likesReceived }`.
- `Dockerfile` + `docker-compose.yml` (MongoDB + API), ESLint, seed script.

### Error contract

| Case | Code |
|---|---|
| Invalid input, or not logged in when calling a cloud function | `142` VALIDATION_ERROR |
| Unknown post (`toggleLike`, comment on a missing post), unknown user (`userStats`) | `101` OBJECT_NOT_FOUND |
| Forbidden by CLP or ACL | Parse default (`101` or `119`) |

## Project structure

```text
src/
  index.js        entry point: loads .env, starts the server, handles SIGINT/SIGTERM
  server.js       Express + Parse Server setup, in-memory MongoDB fallback
  config.js       configuration from environment variables
  schema.js       classes, fields and Class-Level Permissions
  indexes.js      MongoDB indexes the Parse schema cannot express (unique like)
cloud/
  main.js         Cloud Code entry point
  triggers/       beforeSave / afterSave / afterDelete for Post and Comment
  functions/      toggleLike, userStats
  lib/            validation, ACL and post helpers
tests/            API tests (node:test)
scripts/seed.js   demo data through the public API
```

## Choices

- **Schema as code.** Classes, fields and CLPs are declared once in `src/schema.js` and
  applied by Parse Server at every startup, with `lockSchemas: true`, so clients can neither
  create classes nor add fields.
- **Server-owned fields are ignored, not rejected.** A client that sends `author`,
  `likesCount` or `commentsCount` gets them overwritten (create) or restored to the stored
  value (update) instead of an error, as the brief says client values are ignored.
- **Permissions in two layers.** CLPs decide who can create (logged-in users only, nobody for
  `Like`); per-object ACLs decide who can edit (the author only). The ACL itself cannot be
  changed by the client.
- **Atomic counters.** `commentsCount` and `likesCount` use `increment()`, which is atomic in
  MongoDB. In `toggleLike`, only the call that really created or removed a `Like` changes the
  counter, and the unique index rejects duplicate likes, so the counter equals the number of
  likes even under parallel calls.
- **Master key handling.** Read from `PARSE_MASTER_KEY` only, accepted from localhost only.
  If it is missing in development, a random per-process key is generated (with a warning)
  so `npm start` still works; with `NODE_ENV=production` a missing key stops the server.
- **Black-box tests with no extra framework.** `node:test` + `fetch` against a real server,
  which tests the actual REST contract, CLPs and ACLs rather than mocked internals.
- **CommonJS** to keep Cloud Code loading simple and compatible with every supported Node version.

## Not done / known limits

- The counters rely on triggers: if MongoDB fails between the comment write and the counter
  update, a counter could drift. There is no recount job yet.
- No rate limiting, so `toggleLike` or sign-up could be spammed.
- Comments of a deleted post are removed in batches by Cloud Code, which is fine for a blog
  but would need a background job for very large posts.

## What I would improve with more time

- A scheduled job that recomputes counters, and the same unique-index approach for any
  other "one per user" rule.
- Rate limiting (Parse Server `rateLimit` option) on sign-up, login and `toggleLike`.
- TypeScript for Cloud Code, and a CI pipeline running lint and tests on every push.
- Email verification and password reset with a mail adapter.
- Pagination and sorting conventions documented for clients (e.g. newest posts first).
