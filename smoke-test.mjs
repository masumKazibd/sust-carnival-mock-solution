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
    { id: 'T-empty', msg: '',                                                    expType: 'other',                           expSev: 'low',      expReview: false },
    { id: 'T-mix', msg: 'I lost my card and someone called asking my PIN',        expType: 'phishing_or_social_engineering', expSev: 'critical', expReview: true  },
    { id: 'T-cb',  msg: 'I want a chargeback for the duplicate charge',          expType: 'refund_request',                  expSev: 'low',      expReview: false },
];

let pass = 0, fail = 0;
const failures = [];
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
console.log(`\n${pass}/${pass + fail} passed`);
if (fail) {
    console.log('\nFAILURES:');
    for (const f of failures) console.log(JSON.stringify(f, null, 2));
    process.exit(1);
}