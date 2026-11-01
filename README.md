# Internship Tracker

A small full-stack app for tracking internship applications: where you applied, what stage each one is at, and how many are in each stage.

**Stack:** React (Vite) · Node.js + Express · PostgreSQL · JWT auth · Jest + Supertest · Docker · GitHub Actions

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
- **One refresh at a time.** Because refresh tokens are single-use, two requests refreshing at the same moment (e.g. parallel API calls after the access token expires) would make the second one fail and log the user out. The client shares a single in-flight refresh promise.
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

## Tests

```bash
cd server && npm test
```

19 API tests against a real Postgres database: registration and validation, login, expired and forged tokens, refresh rotation and reuse, logout revocation, CRUD, cross-user access (another user's application returns 404), status filtering and stats. CI runs them on every push, plus lint and build for the client.

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
- Schema is created with `CREATE TABLE IF NOT EXISTS` on startup; a real migration tool would be better once the schema changes.
- No frontend tests yet.
