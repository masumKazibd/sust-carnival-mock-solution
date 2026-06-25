# QueueStorm Warmup Mock

Backend for the SUST CSE Society QueueStorm warmup mock: registrations, Codeforces polling, auto-judging with a probabilistic cheat detector, and a leaderboard.

## Stack

- Node.js 20 + Express 5
- PostgreSQL 16 (Drizzle ORM)
- Redis 7 (BullMQ)
- Docker / Docker Compose

## Quickstart

```bash
# 1. Copy env (defaults are sane for docker compose)
cp .env.example .env

# 2. Build + start the full stack (postgres, redis, migrate, api, worker)
docker compose up --build

# 3. Smoke test
curl -s localhost:3000/health
```

The `migrate` service applies Drizzle migrations once on startup. The `api` and `worker` services wait for it to complete.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness check |
| POST | `/register` | Register a Codeforces handle |
| POST | `/contests/:contest_id/join` | Join a contest (password auth) |
| GET | `/contests/:contest_id/leaderboard` | Top 100 by accepted count |
| GET | `/users/:handle/submissions` | Submission history (filter by `?contest_id=`) |

### Examples

```bash
# Register
curl -X POST localhost:3000/register \
  -H 'content-type: application/json' \
  -d '{"handle":"tourist","email":"t@x.io","phone":"+8801700000000","password":"hunter2"}'

# Join
curl -X POST localhost:3000/contests/qstorm-warmup-1/join \
  -H 'content-type: application/json' \
  -d '{"handle":"tourist","password":"hunter2"}'

# Leaderboard
curl localhost:3000/contests/qstorm-warmup-1/leaderboard

# Submissions
curl 'localhost:3000/users/tourist/submissions?contest_id=qstorm-warmup-1'
```

## Configuration (env vars)

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | 3000 | API port |
| `DATABASE_URL` | `postgres://queuestorm:queuestorm@postgres:5432/queuestorm` | Postgres DSN |
| `REDIS_URL` | `redis://redis:6379` | Redis DSN for BullMQ |
| `CODEFORCES_INTERVAL_MS` | 5000 | Poll interval |
| `CHEAT_PROBABILITY` | 0.05 | P(verdict=CHEATER) for accepted submissions |
| `CONTEST_ID` | `qstorm-warmup-1` | Active contest ID (matches CF contestId) |
| `PROBLEM_ID` | `A` | Active problem index |
| `BCRYPT_ROUNDS` | 10 | bcrypt cost factor |
| `NODE_ENV` | development | Runtime mode |

## How the judge works

1. Worker polls Codeforces `/user.status` every 5s for every registered handle.
2. New submissions to Problem A of the active contest are inserted into `submissions` with `verdict='PENDING'`.
3. A judge job is enqueued. The judge:
   - Maps the Codeforces verdict via `CF_VERDICT_MAP` (`OK → ACCEPTED`, etc.).
   - For Problem A, additionally checks the source for a recognizable solution pattern.
   - With probability `CHEAT_PROBABILITY` (default 5%), an otherwise-`ACCEPTED` submission is flipped to `VERDICT_PENDING: CHEATER DETECTED`.

## Tests

Unit + nock-based tests (no infrastructure):

```bash
npm install
npm test
```

Integration tests require Postgres + Redis running:

```bash
docker compose up -d postgres redis
DATABASE_URL=postgres://queuestorm:queuestorm@localhost:5432/queuestorm \
REDIS_URL=redis://localhost:6379 \
npm test
```

## Local development (without Docker)

```bash
npm install
docker compose up -d postgres redis migrate
DATABASE_URL=postgres://queuestorm:queuestorm@localhost:5432/queuestorm \
REDIS_URL=redis://localhost:6379 \
npm run dev          # API on :3000

# In another terminal:
DATABASE_URL=postgres://queuestorm:queuestorm@localhost:5432/queuestorm \
REDIS_URL=redis://localhost:6379 \
npm run worker
```