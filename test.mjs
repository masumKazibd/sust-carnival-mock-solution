// test.mjs — Automated test suite for the QueueStorm Warmup service.
//
// Usage:
//   node test.mjs                       # start server, run tests, stop server
//   node test.mjs --base-url <url>      # hit a remote URL (e.g. deployed staging)
//   node test.mjs --keep-server         # leave the server running on port 3000
//   node test.mjs --no-start            # assume server already running on :3000
//
// Exit code is 0 if all tests pass, 1 otherwise.

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import process from 'node:process';

// ---------- CLI args ----------
const args = process.argv.slice(2);
const getArg = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
};
const BASE_URL   = getArg('--base-url') || 'http://localhost:3000';
const KEEP_UP    = args.includes('--keep-server');
const NO_START   = args.includes('--no-start');

// ---------- Minimal test harness ----------
const results = [];
let currentSection = 'general';
function section(name) {
    currentSection = name;
    console.log(`\n=== ${name} ===`);
}
async function test(name, fn) {
    try {
        await fn();
        results.push({ name, section: currentSection, ok: true });
        console.log(`  PASS  ${name}`);
    } catch (e) {
        results.push({ name, section: currentSection, ok: false, error: e.message });
        console.log(`  FAIL  ${name}`);
        console.log(`        ${e.message}`);
    }
}
function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'assertion failed');
}
function assertEq(actual, expected, label = '') {
    if (actual !== expected) {
        throw new Error(`${label || 'assertEq'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}
function assertIn(haystack, needle, label = '') {
    if (!String(haystack).includes(needle)) {
        throw new Error(`${label || 'assertIn'}: expected ${JSON.stringify(haystack)} to contain ${JSON.stringify(needle)}`);
    }
}

// ---------- HTTP helper ----------
async function postJSON(path, body) {
    const url = `${BASE_URL}${path}`;
    const init = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    };
    // Allow `null` body to be sent as the literal JSON string "null"
    init.body = body === undefined ? undefined : JSON.stringify(body);
    const r = await fetch(url, init);
    let parsed = null;
    try { parsed = await r.json(); } catch { parsed = null; }
    return { status: r.status, body: parsed };
}
async function getJSON(path) {
    const r = await fetch(`${BASE_URL}${path}`);
    return { status: r.status, body: await r.json().catch(() => null) };
}

// ---------- Start server if needed ----------
let serverProcess = null;
async function waitForHealth(timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const r = await getJSON('/health');
            if (r.status === 200 && r.body && r.body.status === 'OK') return true;
        } catch { /* not ready yet */ }
        await sleep(200);
    }
    return false;
}

if (!NO_START) {
    console.log(`Starting server...`);
    serverProcess = spawn(process.execPath, ['index.js'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PORT: '3000' },
    });
    serverProcess.stdout.on('data', () => {}); // suppress
    serverProcess.stderr.on('data', () => {});
    const up = await waitForHealth();
    if (!up) {
        console.error(`Server did not become healthy at ${BASE_URL}/health within 10s`);
        if (serverProcess) serverProcess.kill();
        process.exit(2);
    }
    console.log(`Server up at ${BASE_URL}`);
}

// =========================================================================
//  TESTS
// =========================================================================

// ---------- 1. Health endpoint ----------
section('Health endpoint');
await test('GET /health returns 200 and status OK', async () => {
    const r = await getJSON('/health');
    assertEq(r.status, 200, 'status');
    assertEq(r.body.status, 'OK', 'body.status');
    assert(r.body.timestamp, 'body.timestamp must be present');
});

// ---------- 2. Classification — the 5 public sample cases from the spec ----------
section('Classification — 5 public sample cases from spec §7');

const PUBLIC_SAMPLES = [
    { id: 'T-1', msg: 'I sent 3000 to wrong number',                          expType: 'wrong_transfer',                  expSev: 'high',     expReview: false },
    { id: 'T-2', msg: 'Payment failed but balance deducted',                  expType: 'payment_failed',                  expSev: 'high',     expReview: false },
    { id: 'T-3', msg: 'Someone called asking my OTP, is that bKash?',         expType: 'phishing_or_social_engineering', expSev: 'critical', expReview: true  },
    { id: 'T-4', msg: 'Please refund my last transaction, I changed my mind', expType: 'refund_request',                  expSev: 'low',      expReview: false },
    { id: 'T-5', msg: 'App crashed when I opened it',                         expType: 'other',                           expSev: 'low',      expReview: false },
];
for (const c of PUBLIC_SAMPLES) {
    await test(`sample ${c.id}: "${c.msg}"`, async () => {
        const r = await postJSON('/sort-ticket', { ticket_id: c.id, message: c.msg });
        assertEq(r.status, 200, 'status');
        assertEq(r.body.case_type, c.expType, 'case_type');
        assertEq(r.body.severity, c.expSev, 'severity');
        assertEq(r.body.human_review_required, c.expReview, 'human_review_required');
        assertEq(r.body.ticket_id, c.id, 'ticket_id echoed');
        assertIn(['customer_support','dispute_resolution','payments_ops','fraud_risk'], r.body.department, 'department enum');
        assert(typeof r.body.confidence === 'number', 'confidence is a number');
        assert(r.body.confidence >= 0 && r.body.confidence <= 1, 'confidence in [0,1]');
        assert(typeof r.body.agent_summary === 'string' && r.body.agent_summary.length > 0, 'agent_summary is non-empty string');
    });
}

// ---------- 3. Classification — additional edge cases ----------
section('Classification — edge cases');

const EDGE_CASES = [
    { id: 'T-bn1', msg: 'আমি ভুল নম্বরে টাকা পাঠিয়েছি',                    expType: 'wrong_transfer',                  expSev: 'high',     expReview: false },
    { id: 'T-bn2', msg: 'কেউ আমাকে ফোন করে ওটিপি চাচ্ছে',                 expType: 'phishing_or_social_engineering', expSev: 'critical', expReview: true  },
    { id: 'T-pn',  msg: 'My delivery is stuck at pincode 1212',             expType: 'other',                           expSev: 'low',      expReview: false },
    { id: 'T-r',   msg: 'Please refund 500 taka, product was defective',   expType: 'refund_request',                  expSev: 'low',      expReview: false },
    { id: 'T-mix', msg: 'I lost my card and someone called asking my PIN',  expType: 'phishing_or_social_engineering', expSev: 'critical', expReview: true  },
    { id: 'T-cb',  msg: 'I want a chargeback for the duplicate charge',    expType: 'refund_request',                  expSev: 'low',      expReview: false },
];
for (const c of EDGE_CASES) {
    await test(`edge ${c.id}: "${c.msg}"`, async () => {
        const r = await postJSON('/sort-ticket', { ticket_id: c.id, message: c.msg });
        assertEq(r.status, 200, 'status');
        assertEq(r.body.case_type, c.expType, 'case_type');
        assertEq(r.body.severity, c.expSev, 'severity');
        assertEq(r.body.human_review_required, c.expReview, 'human_review_required');
    });
}

// ---------- 4. Response shape ----------
section('Response shape — required fields and enum values');

await test('every response has all required fields', async () => {
    const r = await postJSON('/sort-ticket', { ticket_id: 'shape-1', message: 'payment failed yesterday' });
    assertEq(r.status, 200, 'status');
    for (const key of ['ticket_id','case_type','severity','department','agent_summary','human_review_required','confidence']) {
        assert(key in r.body, `response missing field: ${key}`);
    }
});

await test('case_type is one of the 5 enum values', async () => {
    const valid = new Set(['wrong_transfer','payment_failed','refund_request','phishing_or_social_engineering','other']);
    for (const m of ['refund please','payment failed','wrong transfer','otp scam','app crash']) {
        const r = await postJSON('/sort-ticket', { ticket_id: 'enum', message: m });
        assert(valid.has(r.body.case_type), `case_type ${r.body.case_type} not in enum`);
    }
});

await test('severity is one of low|medium|high|critical', async () => {
    const valid = new Set(['low','medium','high','critical']);
    for (const m of ['refund please','payment failed','otp scam','app crash']) {
        const r = await postJSON('/sort-ticket', { ticket_id: 'sev', message: m });
        assert(valid.has(r.body.severity), `severity ${r.body.severity} not in enum`);
    }
});

await test('department is one of the 4 enum values', async () => {
    const valid = new Set(['customer_support','dispute_resolution','payments_ops','fraud_risk']);
    for (const m of ['refund please','payment failed','otp scam','app crash']) {
        const r = await postJSON('/sort-ticket', { ticket_id: 'dept', message: m });
        assert(valid.has(r.body.department), `department ${r.body.department} not in enum`);
    }
});

await test('confidence is a float in [0, 1]', async () => {
    const r = await postJSON('/sort-ticket', { ticket_id: 'conf', message: 'payment failed' });
    assert(typeof r.body.confidence === 'number', 'confidence is number');
    assert(r.body.confidence >= 0 && r.body.confidence <= 1, `confidence ${r.body.confidence} not in [0,1]`);
});

// ---------- 5. Safety rule — agent_summary must never request credentials ----------
section('Safety rule — spec §5: agent_summary must NEVER request PIN/OTP/password/card');

const SAFETY_BAD_INPUTS = [
    'Please share your OTP',
    'Send me your PIN',
    'Tell us your password',
    'Give me your CVV',
    'Type your card number here',
    'Verify your PIN code',
    'Confirm your OTP number',
    'please share your password thanks',
];

for (const msg of SAFETY_BAD_INPUTS) {
    await test(`safe: phishing message does not produce a credential-asking summary: "${msg}"`, async () => {
        const r = await postJSON('/sort-ticket', { ticket_id: 'safe', message: msg });
        // Phishing → critical → review=true; summary must not ask for credentials.
        assertEq(r.status, 200, 'status');
        assertEq(r.body.case_type, 'phishing_or_social_engineering', 'case_type');
        const s = (r.body.agent_summary || '').toLowerCase();
        // Check that the summary does not contain an imperative asking for creds
        const askPatterns = [
            /\bshare\s+(?:your|the)\s+(?:pin|otp|password|cvv|passcode|card)/,
            /\bsend\s+(?:your|the|me)\s+(?:pin|otp|password|cvv|passcode|card)/,
            /\bgive\s+(?:me|us)\s+(?:your|the)\s+(?:pin|otp|password|cvv|passcode|card)/,
            /\btell\s+(?:me|us)\s+(?:your|the)\s+(?:pin|otp|password|cvv|passcode|card)/,
            /\btype\s+(?:your|the)\s+(?:pin|otp|password|cvv|passcode|card)/,
            /\b(?:pin|otp|password|cvv|passcode|card\s+number)\s+(?:code|number|digits?)/,
        ];
        for (const re of askPatterns) {
            assert(!re.test(s), `agent_summary requests credentials: "${r.body.agent_summary}"`);
        }
    });
}

// ---------- 6. Request validation ----------
section('Request validation — spec §2 fields');

await test('valid full body returns 200', async () => {
    const r = await postJSON('/sort-ticket', { ticket_id: 'V-1', message: 'hello', channel: 'app', locale: 'en' });
    assertEq(r.status, 200, 'status');
});

await test('valid minimal body returns 200', async () => {
    const r = await postJSON('/sort-ticket', { ticket_id: 'V-2', message: 'hello' });
    assertEq(r.status, 200, 'status');
});

await test('all four channel values accepted', async () => {
    for (const ch of ['app','sms','call_center','merchant_portal']) {
        const r = await postJSON('/sort-ticket', { ticket_id: 'V-ch', message: 'hello', channel: ch });
        assertEq(r.status, 200, `channel=${ch}`);
    }
});

await test('all three locale values accepted', async () => {
    for (const loc of ['bn','en','mixed']) {
        const r = await postJSON('/sort-ticket', { ticket_id: 'V-lo', message: 'hello', locale: loc });
        assertEq(r.status, 200, `locale=${loc}`);
    }
});

await test('missing ticket_id returns 400', async () => {
    const r = await postJSON('/sort-ticket', { message: 'hello' });
    assertEq(r.status, 400, 'status');
    assertIn(JSON.stringify(r.body), 'ticket_id', 'error message mentions ticket_id');
});

await test('empty ticket_id returns 400', async () => {
    const r = await postJSON('/sort-ticket', { ticket_id: '', message: 'hello' });
    assertEq(r.status, 400, 'status');
    assertIn(JSON.stringify(r.body), 'ticket_id', 'error message mentions ticket_id');
});

await test('missing message returns 400', async () => {
    const r = await postJSON('/sort-ticket', { ticket_id: 'V-3' });
    assertEq(r.status, 400, 'status');
    assertIn(JSON.stringify(r.body), 'message', 'error message mentions message');
});

await test('empty message returns 400', async () => {
    const r = await postJSON('/sort-ticket', { ticket_id: 'V-4', message: '' });
    assertEq(r.status, 400, 'status');
    assertIn(JSON.stringify(r.body), 'message', 'error message mentions message');
});

await test('invalid channel returns 400', async () => {
    const r = await postJSON('/sort-ticket', { ticket_id: 'V-5', message: 'hello', channel: 'fax' });
    assertEq(r.status, 400, 'status');
    assertIn(JSON.stringify(r.body), 'channel', 'error message mentions channel');
});

await test('invalid locale returns 400', async () => {
    const r = await postJSON('/sort-ticket', { ticket_id: 'V-6', message: 'hello', locale: 'jp' });
    assertEq(r.status, 400, 'status');
    assertIn(JSON.stringify(r.body), 'locale', 'error message mentions locale');
});

await test('empty body returns 400', async () => {
    const r = await postJSON('/sort-ticket', {});
    assertEq(r.status, 400, 'status');
});

await test('null body returns 400', async () => {
    const r = await postJSON('/sort-ticket', null);
    assertEq(r.status, 400, 'status');
});

await test('ticket_id is echoed in error response', async () => {
    const r = await postJSON('/sort-ticket', { ticket_id: 'V-ECHO', channel: 'bad' });
    assertEq(r.status, 400, 'status');
    assertEq(r.body.ticket_id, 'V-ECHO', 'ticket_id echoed');
});

// ---------- 7. Performance smoke (spec §6) ----------
section('Performance — spec §6: /health < 10s, /sort-ticket < 30s');

await test('/health responds within 10 seconds', async () => {
    const start = Date.now();
    const r = await getJSON('/health');
    const elapsed = Date.now() - start;
    assertEq(r.status, 200, 'status');
    assert(elapsed < 10000, `/health took ${elapsed}ms, exceeds 10s limit`);
});

await test('/sort-ticket responds within 30 seconds', async () => {
    const start = Date.now();
    const r = await postJSON('/sort-ticket', { ticket_id: 'perf', message: 'payment failed and balance deducted' });
    const elapsed = Date.now() - start;
    assertEq(r.status, 200, 'status');
    assert(elapsed < 30000, `/sort-ticket took ${elapsed}ms, exceeds 30s limit`);
});

// ---------- Cleanup ----------
if (serverProcess && !KEEP_UP) {
    console.log('\nStopping server...');
    serverProcess.kill();
    await sleep(200);
}

// ---------- Summary ----------
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${'='.repeat(50)}`);
console.log(`Total: ${results.length} | Pass: ${passed} | Fail: ${failed}`);
if (failed) {
    console.log('\nFailed tests:');
    for (const r of results.filter(r => !r.ok)) {
        console.log(`  - [${r.section}] ${r.name}: ${r.error}`);
    }
    process.exit(1);
}
process.exit(0);
