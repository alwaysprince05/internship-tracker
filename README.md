# Internship Tracker

[![CI](https://github.com/alwaysprince05/internship-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/alwaysprince05/internship-tracker/actions/workflows/ci.yml)

A small full-stack app for tracking internship applications: where you applied, what stage each one is at, and how many are in each stage.

**Stack:** React (Vite) · Node.js + Express · PostgreSQL · JWT auth · Jest + Supertest · Vitest + Testing Library · Docker · GitHub Actions

## Features

- Sign up / log in with email and password
- Add, edit and delete applications (company, role, status, date, link, notes)
- Status counts at the top double as filters
- Each user only ever sees their own data

## How auth works

- Passwords are hashed with bcrypt (cost 12).
- Login returns a short-lived **access token** (JWT, 15 min). The client keeps it in memory only, not in localStorage.
- A **refresh token** (random 48 bytes, 7 days) is set as an `httpOnly` cookie scoped to `/api/auth`, so JavaScript can't read it.
- Only the SHA-256 hash of each refresh token is stored in the database.
- Refresh tokens are rotated: every `/refresh` deletes the old one and issues a new one, so a stolen token can be used at most once. Logout deletes it.
- Login is rate-limited (10 attempts / 15 min), and wrong-password and unknown-email return the same error so emails can't be enumerated.

## Design notes

- **Default dates use India time, not UTC.** Postgres `CURRENT_DATE` and JS `toISOString()` are both UTC, which made applications added after midnight IST show up as the previous day. The server uses `APP_TIMEZONE` and the client uses the local date. There is a test for this.
- **Impossible input is a 400, not a 500.** A date like `2026-02-30` matches `YYYY-MM-DD` but Postgres rejects it, and an id like `99999999999` doesn't fit in an `INTEGER`. Both used to reach the database and come back as a 500; now they're caught before the query.
- **One refresh at a time.** Because refresh tokens are single-use, two requests refreshing at the same moment (e.g. parallel API calls after the access token expires) would make the second one fail and log the user out. The client shares a single in-flight refresh promise.
- **Old responses don't win.** If you switch the status filter while a request is still loading, the late response for the old filter is ignored.
- **One origin in production.** The server also serves the built client, so the refresh cookie is first-party (`SameSite=Strict`). With the client and API on different domains, browsers that block third-party cookies would log the user out on every reload.
- `PATCH` only updates fields that pass the zod schema, so extra fields like `user_id` in the body are dropped, not written.

## Running locally

Requirements: Node 20+, Docker.

```bash
docker compose up -d                 # Postgres on localhost:5433
docker exec internship-tracker-db-1 psql -U tracker -c "CREATE DATABASE tracker_test"

cd server
cp .env.example .env                 # then fill in the two JWT secrets
npm install
npm run dev                          # http://localhost:4000

cd ../client
npm install
npm run dev                          # http://localhost:5173 (proxies /api to :4000)
```

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## Deployment

The root `Dockerfile` builds the client and puts it next to the server, so one container serves both the app and `/api` (64 MB image, runs as a non-root user). On `SIGTERM` the server finishes open requests and closes the database pool.

`render.yaml` describes the Render service: built from the Dockerfile, health check on `/api/health`, deploys only after CI passes. Render generates the two JWT secrets; `DATABASE_URL` is set in the dashboard and points to a managed Postgres (Neon) with `sslmode=verify-full`.

```bash
docker build -t internship-tracker .
docker run -p 4000:4000 -e DATABASE_URL=... -e JWT_ACCESS_SECRET=... -e JWT_REFRESH_SECRET=... internship-tracker
```

## Database migrations

Schema changes live in `server/migrations/NNN_name.sql`. On startup the server runs every file that isn't listed in the `schema_migrations` table yet, in order, each in its own transaction. A Postgres advisory lock makes sure two instances starting together don't run the same migration twice. To change the schema, add a new numbered file; never edit one that has already run.

## Tests

```bash
cd server && npm test     # needs the Postgres container running
cd client && npm test
```

- **Server (27 tests, Jest + Supertest, real Postgres):** registration and validation, login, expired and forged tokens, refresh rotation and reuse, expired-token cleanup, logout revocation, CRUD, cross-user access (another user's application returns 404), impossible dates and ids, status filtering and stats, migrations being safe to run twice or in parallel, serving the built client (deep links, cache headers, JSON 404s under `/api`).
- **Client (12 tests, Vitest + Testing Library):** parallel 401s share a single refresh, error messages from the API, the form's null handling and error display, login/sign-up, the dashboard ignoring a stale filter response and showing a failed delete.

CI runs both on every push, plus lint and build for the client.

## API

| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/register` | – |
| POST | `/api/auth/login` | – |
| POST | `/api/auth/refresh` | refresh cookie |
| POST | `/api/auth/logout` | refresh cookie |
| GET | `/api/applications?status=` | Bearer |
| GET | `/api/applications/stats` | Bearer |
| POST | `/api/applications` | Bearer |
| PATCH | `/api/applications/:id` | Bearer |
| DELETE | `/api/applications/:id` | Bearer |

## Limitations / next steps

- No email verification or password reset yet.
- No end-to-end browser tests; the client tests mock `fetch`.
