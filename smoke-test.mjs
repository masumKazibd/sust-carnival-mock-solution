// Smoke test: hit the running server with all 5 public samples + edge cases.
const cases = [
    // The 5 public samples from the spec
    { id: 'T-1', msg: 'I sent 3000 to wrong number',                              expType: 'wrong_transfer',                  expSev: 'high',     expReview: false },
    { id: 'T-2', msg: 'Payment failed but balance deducted',                      expType: 'payment_failed',                  expSev: 'high',     expReview: false },
    { id: 'T-3', msg: 'Someone called asking my OTP, is that bKash?',             expType: 'phishing_or_social_engineering', expSev: 'critical', expReview: true  },
    { id: 'T-4', msg: 'Please refund my last transaction, I changed my mind',     expType: 'refund_request',                  expSev: 'low',      expReview: false },
    { id: 'T-5', msg: 'App crashed when I opened it',                             expType: 'other',                           expSev: 'low',      expReview: false },
    // Edge cases
    { id: 'T-bn1', msg: 'আমি ভুল নম্বরে টাকা পাঠিয়েছি',                          expType: 'wrong_transfer',                  expSev: 'high',     expReview: false },
    { id: 'T-bn2', msg: 'কেউ আমাকে ফোন করে ওটিপি চাচ্ছে',                       expType: 'phishing_or_social_engineering', expSev: 'critical', expReview: true  },
    { id: 'T-pn',  msg: 'My delivery is stuck at pincode 1212',                   expType: 'other',                           expSev: 'low',      expReview: false },
    { id: 'T-r',   msg: 'Please refund 500 taka, product was defective',         expType: 'refund_request',                  expSev: 'low',      expReview: false },
    { id: 'T-mix', msg: 'I lost my card and someone called asking my PIN',        expType: 'phishing_or_social_engineering', expSev: 'critical', expReview: true  },
    { id: 'T-cb',  msg: 'I want a chargeback for the duplicate charge',          expType: 'refund_request',                  expSev: 'low',      expReview: false },
];

// ---------- Validation tests ----------
const validationCases = [
    // [name, body, expectStatus, expectErrorContains]
    ['valid full body',          { ticket_id: 'V-1', message: 'hello', channel: 'app', locale: 'en' }, 200, null],
    ['valid minimal body',       { ticket_id: 'V-2', message: 'hello' },                                200, null],
    ['missing ticket_id',        { message: 'hello' },                                                 400, 'ticket_id'],
    ['empty ticket_id',          { ticket_id: '', message: 'hello' },                                  400, 'ticket_id'],
    ['missing message',          { ticket_id: 'V-3' },                                                 400, 'message'],
    ['empty message',            { ticket_id: 'V-4', message: '' },                                    400, 'message'],
    ['bad channel',              { ticket_id: 'V-5', message: 'hello', channel: 'fax' },               400, 'channel'],
    ['bad locale',               { ticket_id: 'V-6', message: 'hello', locale: 'jp' },                 400, 'locale'],
    ['all four channels work',   { ticket_id: 'V-7', message: 'hello', channel: 'sms' },               200, null],
    ['all three locales work',   { ticket_id: 'V-8', message: 'hello', locale: 'mixed' },             200, null],
    ['empty body',               {},                                                                    400, 'ticket_id'],
    ['null body',                null,                                                                  400, 'error'],
    ['echoes ticket_id on err',  { ticket_id: 'V-ECHO', channel: 'bad' },                              400, 'V-ECHO'],
];

let pass = 0, fail = 0;
const failures = [];

// Classification tests
for (const c of cases) {
    const r = await fetch('http://localhost:3000/sort-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ ticket_id: c.id, message: c.msg }),
    });
    const body = await r.json();
    const okType = body.case_type === c.expType;
    const okSev  = body.severity === c.expSev;
    const okRev  = body.human_review_required === c.expReview;
    const ok = okType && okSev && okRev;
    if (ok) pass++; else { fail++; failures.push({ c, body }); }
    console.log((ok ? 'PASS' : 'FAIL') +
        ` | case=${body.case_type} sev=${body.severity} dept=${body.department} review=${body.human_review_required} conf=${body.confidence}` +
        ` | [${c.id}] ${c.msg}`);
}

// Validation tests
console.log('\n--- Validation tests ---');
for (const [name, body, expStatus, expErr] of validationCases) {
    const r = await fetch('http://localhost:3000/sort-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
    });
    const respBody = await r.json().catch(() => null);
    const statusOk = r.status === expStatus;
    let errOk = expErr === null;
    if (!errOk && respBody) {
        // Accept the expected token if it appears anywhere in the response body
        const blob = JSON.stringify(respBody);
        errOk = blob.includes(expErr);
    }
    const ok = statusOk && errOk;
    if (ok) pass++; else { fail++; failures.push({ name, body, respBody, expStatus, expErr }); }
    console.log((ok ? 'PASS' : 'FAIL') +
        ` | status=${r.status} (expected ${expStatus}) | ${name}`);
}
console.log(`\n${pass}/${pass + fail} passed`);
if (fail) {
    console.log('\nFAILURES:');
    for (const f of failures) console.log(JSON.stringify(f, null, 2));
    process.exit(1);
}