# QueueStorm Warmup — Mock Preliminary Solution

A small Express.js web service that classifies one customer support ticket at a time
and returns a structured triage response. Built for the **bKash / SUST CSE Carnival
2026 Codex Community Hackathon — Mock Preliminary Round**.

The service answers four questions about a customer message:

1. **What kind of problem is this?** (`case_type`)
2. **How serious is it?** (`severity`)
3. **Which team should handle it?** (`department`)
4. **What is a one-sentence summary an agent can read in 2 seconds?** (`agent_summary`)

Plus it raises a `human_review_required` flag for phishing or critical cases, and
returns a `confidence` score.

The service is **fully rules-based** (regex + templates). No LLM dependency, no
GPU, no external service calls.

---

## Table of Contents

- [Quick start](#quick-start)
- [API reference](#api-reference)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Running the test suite](#running-the-test-suite)
- [Deployment guide (runbook)](#deployment-guide-runbook)
- [Design notes](#design-notes)
- [Submission artifacts](#submission-artifacts)

---

## Quick start

### Prerequisites
- Node.js **18 or newer** (tested on Node 20 and 24)
- npm 9+

### Install & run
```bash
# 1. Install dependencies (express + dotenv)
npm install

# 2. Start the server (default port 3000)
npm start
# or, equivalently:
node index.js
# → "Server running on port 3000"

# 3. Hit the health endpoint
curl http://localhost:3000/health
# → {"status":"OK","timestamp":"..."}
```

> **Note on `index.js`:** The Express app is `export default`-ed so it works as a
> Vercel serverless function. `app.listen()` is only called when
> `NODE_ENV !== 'production'`, so local dev still works exactly like before.

To use a custom port:
```bash
PORT=8080 node index.js
```

---

## API reference

### `GET /health`

Liveness probe. Returns within milliseconds.

**Response 200:**
```json
{
  "status": "OK",
  "timestamp": "2026-06-26T10:00:00.000Z"
}
```

---

### `POST /sort-ticket`

Classifies a single support ticket.

**Request body** (JSON, `Content-Type: application/json`):

| Field       | Type   | Required | Allowed values                                     |
|-------------|--------|----------|----------------------------------------------------|
| `ticket_id` | string | **Yes**  | any non-empty string, max 128 chars                |
| `message`   | string | **Yes**  | any non-empty string, max 5000 chars               |
| `channel`   | string | No       | `app`, `sms`, `call_center`, `merchant_portal`     |
| `locale`    | string | No       | `bn`, `en`, `mixed`                                |

**Response 200:**
```json
{
  "ticket_id": "T-001",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "payments_ops",
  "agent_summary": "Customer reports sending money to the wrong recipient and requests recovery. The dispute team will follow up on the recovery process.",
  "human_review_required": false,
  "confidence": 0.9
}
```

| Field                   | Type    | Description                                                                                  |
|-------------------------|---------|----------------------------------------------------------------------------------------------|
| `ticket_id`             | string  | Echoed back from the request                                                                  |
| `case_type`             | enum    | `wrong_transfer`, `payment_failed`, `refund_request`, `phishing_or_social_engineering`, `other` |
| `severity`              | enum    | `low`, `medium`, `high`, `critical`                                                          |
| `department`            | enum    | `customer_support`, `dispute_resolution`, `payments_ops`, `fraud_risk`                       |
| `agent_summary`         | string  | 1–2 neutral sentences; **never asks for PIN / OTP / password / card number**                  |
| `human_review_required` | boolean | `true` for phishing or critical severity                                                      |
| `confidence`            | number  | Float in `[0, 1]`                                                                            |

**Response 400 (validation error):**
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "message", "message": "message is required and must be a non-empty string" }
  ],
  "ticket_id": "T-001"
}
```

### Sample requests

```bash
# 1. Wrong transfer
curl -X POST http://localhost:3000/sort-ticket \
  -H "Content-Type: application/json" \
  -d '{"ticket_id":"T-1","message":"I sent 3000 to wrong number"}'

# 2. Phishing (flagged for human review)
curl -X POST http://localhost:3000/sort-ticket \
  -H "Content-Type: application/json" \
  -d '{"ticket_id":"T-2","message":"Someone called asking my OTP, is that bKash?"}'

# 3. Refund
curl -X POST http://localhost:3000/sort-ticket \
  -H "Content-Type: application/json" \
  -d '{"ticket_id":"T-3","message":"Please refund my last transaction","channel":"app","locale":"en"}'

# 4. Bangla message
curl -X POST http://localhost:3000/sort-ticket \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"ticket_id":"T-4","message":"আমি ভুল নম্বরে টাকা পাঠিয়েছি"}'
```

---

## Environment variables

| Variable | Default | Description                              |
|----------|---------|------------------------------------------|
| `PORT`   | `3000`  | Port the HTTP server listens on          |

No secrets, API keys, or external credentials are required. **No LLM calls** —
the service is 100% rule-based.

---

## Project structure

```
.
├── index.js          # Express server + all classifiers + safety net
├── test.mjs          # Self-contained test suite (40 tests, 7 sections)
├── vercel.json       # Vercel routing config (sends all routes to index.js)
├── package.json      # "type": "module", deps: express + dotenv
├── package-lock.json
├── .gitignore        # node_modules, .env
└── README.md         # this file
```

**Total source: ~465 lines of `index.js` + ~360 lines of `test.mjs`** (no other
runtime files; `vercel.json` is 10 lines of static config).

---

## Running the test suite

The test file is self-contained — it auto-starts the server, runs all 40 tests,
and tears the server down. Zero dependencies.

```bash
node test.mjs
```

Sample output (abbreviated):
```
=== Health endpoint ===
  PASS  GET /health returns 200 and status OK

=== Classification — 5 public sample cases from spec §7 ===
  PASS  sample T-1: "I sent 3000 to wrong number"
  PASS  sample T-2: "Payment failed but balance deducted"
  PASS  sample T-3: "Someone called asking my OTP, is that bKash?"
  PASS  sample T-4: "Please refund my last transaction, I changed my mind"
  PASS  sample T-5: "App crashed when I opened it"
  ...
==================================================
Total: 40 | Pass: 40 | Fail: 0
```

Test exit code is `0` on success, `1` on any failure (CI-friendly).

### CLI flags

```bash
node test.mjs                            # auto-start server, run, stop
node test.mjs --base-url https://...     # hit a deployed URL instead of localhost
node test.mjs --keep-server              # leave server running after tests
node test.mjs --no-start                 # assume server already running on :3000
```

### What's tested

| Section | # | Coverage |
|---|---|---|
| Health endpoint | 1 | 200 + status OK + timestamp |
| 5 public sample cases | 5 | Exact cases from spec §7 (wrong_transfer, payment_failed, phishing, refund, other) |
| Edge cases | 6 | Bangla, false-positive guards, chargeback, mixed phishing |
| Response shape | 5 | All required fields, all enum values, confidence ∈ [0,1] |
| Safety rule | 8 | Spec §5: summaries never request PIN/OTP/password/CVV/card |
| Request validation | 13 | All 4 channels, all 3 locales, 400 on missing/bad fields, ticket_id echoed |
| Performance | 2 | `/health` < 10s, `/sort-ticket` < 30s (spec §6) |

---

## Deployment guide (runbook)

The service is a single Node.js process that exposes HTTP on `process.env.PORT`
(default 3000). It works on any host that runs Node 18+.

### Generic steps (any host)

```bash
# 1. Clone & install
git clone <repo-url> queueStorm
cd queueStorm
npm install

# 2. Run
PORT=8080 node index.js

# 3. Smoke test
curl http://localhost:8080/health
```

### Platform-specific

#### Render
1. New → Web Service → connect repo.
2. **Build command:** `npm install`
3. **Start command:** `node index.js`
4. **Environment variable:** `PORT=10000` (Render sets this automatically; the
   server reads `process.env.PORT`).
5. Deploy. The URL will look like `https://<service-name>.onrender.com`.

#### Railway
1. New Project → Deploy from GitHub → pick the repo.
2. Add env var `PORT=3000` (Railway injects one automatically; you can leave it).
3. Deploy. Default URL: `https://<project>.up.railway.app`.

#### Fly.io
```bash
fly launch --copy-config      # generates fly.toml
fly deploy
```

#### Vercel
Vercel is fully supported. The project ships with a `vercel.json` that routes
all incoming requests to the Express app via `@vercel/node`.

**Option A — Vercel Dashboard (recommended):**
1. Go to [vercel.com](https://vercel.com) → sign in with GitHub.
2. Click **"Add New…" → "Project"**.
3. Import the `sust-carnival-mock-solution` repo.
4. Vercel auto-detects the framework. Leave defaults:
   - **Framework Preset:** Other
   - **Build Command:** *(leave empty)*
   - **Install Command:** `npm install`
   - **Output Directory:** *(leave empty)*
5. *(Optional)* Add environment variables (e.g. `NODE_ENV=production`).
6. Click **"Deploy"**. Within ~1–2 minutes you'll get a URL like
   `https://sust-carnival-mock-solution.vercel.app`.

**Option B — Vercel CLI:**
```bash
# Install CLI
npm install -g vercel

# Login (opens browser)
vercel login

# Deploy (from project root)
vercel              # preview deployment
vercel --prod       # production deployment
```

> **How it works:** `index.js` exports the Express app as the default export.
> `vercel.json` tells Vercel to use `@vercel/node` and forwards all routes
> (`/(.*)`) to `index.js`. In production (`NODE_ENV=production`) `app.listen()`
> is skipped, so the process boots as a pure serverless handler — no port
> binding required.

**After every `git push`**, Vercel automatically redeploys. No further action
needed.

#### EC2 / generic VPS
```bash
git clone <repo-url>
cd queueStorm
npm install
PORT=3000 nohup node index.js &
# or with pm2 / systemd for auto-restart
```

#### Poridhi Lab
Use the Node.js container template, mount this repo, then:
```bash
npm install && PORT=3000 node index.js
```

### Post-deploy verification

```bash
# 1. Health
curl https://<your-url>/health
# → {"status":"OK","timestamp":"..."}

# 2. Sort ticket
curl -X POST https://<your-url>/sort-ticket \
  -H "Content-Type: application/json" \
  -d '{"ticket_id":"DEPLOY-1","message":"I sent 5000 to a wrong number"}'

# 3. Or run the bundled test suite against the deployed URL
node test.mjs --base-url https://<your-url> --no-start
```

Expected: 40/40 tests pass within a few seconds.

---

## Design notes

### Classification rules

The classifier walks four prioritized cue lists, in this order:

1. **Phishing / social engineering** — matches cues like `otp`, `pin`, `password`,
   `cvv`, `card number`, `phishing`, `scam`, `suspicious link`, `fake call`,
   `someone called asking my …`, plus Bangla equivalents (`ওটিপি`, `পিন`, `পাসওয়ার্ড`,
   `ভুল নম্বর`). Returns `critical` severity, `fraud_risk` department.
2. **Refund request** — matches `refund`, `return my money`, `reimburse`,
   `chargeback`, `cancel my order/payment/transaction`. Returns `low` severity,
   `dispute_resolution` department.
3. **Payment failed** — matches `payment failed`, `transaction failed`, `payment
   declined`, `couldn't pay`, `deducted but not received`, `balance was deducted`,
   `double charge`. Returns `high` severity, `payments_ops` department.
4. **Wrong transfer** — matches `wrong transfer/number/account/recipient`,
   `mistakenly sent`, `sent to wrong`, `by mistake`, plus Bangla (`ভুল নম্বর`,
   `ভুল একাউন্ট`, `ভুল ট্রান্সফার`). Returns `high` severity, `payments_ops` (or
   `dispute_resolution` if the wording leans to recovery).
5. **Other** — fallback. Returns `low` severity, `customer_support` department.
   Confidence drops to `0.5`.

If none of the cues match, the message goes to `other` with a confidence of `0.5`
(the classifier is admitting it doesn't know).

### Bangla support

JavaScript's `\b` only treats ASCII letters as word boundaries, so Bangla cues
use a `token()` helper that anchors on explicit whitespace / punctuation:
```js
const token = (word) =>
    new RegExp(`(^|[\\s,।!?()\\[\\]"'\\-:;])${word}(?=$|[\\s,।!?()\\[\\]"'\\-:;])`);
```
This lets us match `ওটিপি` (OTP), `পিন` (PIN), `পাসওয়ার্ড` (password), `ভুল নম্বর`
(wrong number), `ভুল একাউন্ট` (wrong account) etc.

### Safety rule (spec §5)

**The `agent_summary` field must NEVER ask for PIN / OTP / password / card number.**

Two layers of defense:
1. **Templates are static.** Every possible summary is a hard-coded string, so
   an LLM or dynamic string concatenation can't accidentally produce a
   credential request.
2. **`assertSummarySafe()` runs after every template build.** It scans the
   summary against 5 regex patterns (covering "share your X", "send me your X",
   "verify your X", "your X code/number", "type your X") and throws if any
   match. This catches template bugs during development before they reach the
   grader.

Additionally, the `other` template deliberately does **not** echo the customer's
message verbatim — that way, if a customer pastes their own OTP/PIN into a
support message, it never gets reflected back in the response.

### Why no LLM?

The spec says LLM is allowed but not required. We chose rules for:
- **Speed** — pure regex is sub-millisecond
- **Determinism** — same input → same output, always
- **Cost** — zero API spend, works offline
- **Auditability** — every classification rule is readable JavaScript
- **Safety** — no risk of an LLM hallucinating a credential request

### Why no database / cache / session?

Single-shot request/response. The service is stateless. No persistence needed
for this task.

---

## Submission artifacts

Per the spec, the Google form requires:

| Field | Value |
|---|---|
| GitHub repo URL | (this repo) |
| Live API base URL | (your deployed URL — see Deployment guide) |
| Deployment platform | **Vercel** (recommended) / Render / Railway / Fly / EC2 / Poridhi |
| LLM used | **No** — rules-based only |

---

## License

This is a competition submission. No license granted; please do not redistribute.