import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

// case_type Enum — only these values are allowed
const CASE_TYPES = Object.freeze({
    WRONG_TRANSFER: 'wrong_transfer',
    PAYMENT_FAILED: 'payment_failed',
    REFUND_REQUEST: 'refund_request',
    PHISHING_OR_SOCIAL_ENGINEERING: 'phishing_or_social_engineering',
    OTHER: 'other',
});

const VALID_CASE_TYPES = new Set(Object.values(CASE_TYPES));

// department Enum — only these values are allowed
const DEPARTMENTS = Object.freeze({
    CUSTOMER_SUPPORT: 'customer_support',
    DISPUTE_RESOLUTION: 'dispute_resolution',
    PAYMENTS_OPS: 'payments_ops',
    FRAUD_RISK: 'fraud_risk',
});

const VALID_DEPARTMENTS = new Set(Object.values(DEPARTMENTS));

// Map each case_type to its owning department
const CASE_TYPE_TO_DEPARTMENT = Object.freeze({
    [CASE_TYPES.WRONG_TRANSFER]: DEPARTMENTS.PAYMENTS_OPS,
    [CASE_TYPES.PAYMENT_FAILED]: DEPARTMENTS.PAYMENTS_OPS,
    [CASE_TYPES.REFUND_REQUEST]: DEPARTMENTS.DISPUTE_RESOLUTION,
    [CASE_TYPES.PHISHING_OR_SOCIAL_ENGINEERING]: DEPARTMENTS.FRAUD_RISK,
    [CASE_TYPES.OTHER]: DEPARTMENTS.CUSTOMER_SUPPORT,
});

// severity Enum — only these values are allowed
const SEVERITY = Object.freeze({
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
});

const VALID_SEVERITY = new Set(Object.values(SEVERITY));

// Classify ticket severity from the message + case_type.
// Rules (from spec public samples + general policy):
//   - phishing_or_social_engineering        → critical
//   - payment_failed (esp. balance deducted) → high
//   - wrong_transfer                         → high
//   - refund_request                         → low
//   - other                                  → low (escalated to medium if money mentioned)
function classifySeverity(message = '', case_type) {
    const text = String(message).toLowerCase();

    switch (case_type) {
        case CASE_TYPES.PHISHING_OR_SOCIAL_ENGINEERING:
            return SEVERITY.CRITICAL;

        case CASE_TYPES.PAYMENT_FAILED:
            // "balance deducted" / "money deducted" escalates urgency
            if (/(balance|money).{0,15}(deduct|debited|taken)|lost my money|stuck/.test(text)) {
                return SEVERITY.HIGH;
            }
            return SEVERITY.HIGH; // payment failure is always high per public sample #2

        case CASE_TYPES.WRONG_TRANSFER:
            return SEVERITY.HIGH; // per public sample #1

        case CASE_TYPES.REFUND_REQUEST:
            return SEVERITY.LOW; // per public sample #4

        case CASE_TYPES.OTHER:
        default:
            // Generic complaint that mentions money/transaction bumps to medium
            if (/(money|taka|bdt|payment|transaction|account)/.test(text)) {
                return SEVERITY.MEDIUM;
            }
            return SEVERITY.LOW; // e.g. "App crashed when I opened it" → low (sample #5)
    }
}

// Compute classification confidence in [0, 1].
// Higher when a specific regex matched; lower when falling through to `other`.
function computeConfidence(case_type, message) {
    const text = String(message || '').toLowerCase();

    switch (case_type) {
        case CASE_TYPES.PHISHING_OR_SOCIAL_ENGINEERING:
            // Strong, unambiguous signal — but high stakes so we leave a little headroom
            return 0.95;
        case CASE_TYPES.PAYMENT_FAILED:
            // Boost if balance-deducted cue is present
            return /(balance|money).{0,15}(deduct|debited|taken)|stuck/.test(text) ? 0.95 : 0.9;
        case CASE_TYPES.WRONG_TRANSFER:
            return 0.9;
        case CASE_TYPES.REFUND_REQUEST:
            return 0.9;
        case CASE_TYPES.OTHER:
        default:
            // No signal matched — admit low confidence
            return 0.5;
    }
}

// Decide whether a human must review this ticket.
// Per spec: phishing or critical cases must be human-reviewed.
function requiresHumanReview(case_type, severity) {
    return (
        case_type === CASE_TYPES.PHISHING_OR_SOCIAL_ENGINEERING ||
        severity === SEVERITY.CRITICAL
    );
}

// Classify ticket message into one of the enum values.
// Supports English and Bangla (bn) cues per the locale field.
// Note: JavaScript \b only treats ASCII word chars as word boundaries,
// so Bangla cues use explicit whitespace / punctuation boundaries.
function classifyCaseType(message = '') {
    const text = String(message).toLowerCase();

    // Helper: matches a token only when surrounded by start-of-string,
    // whitespace, or common punctuation. Works for both ASCII and Bangla.
    const token = (word) =>
        new RegExp(`(^|[\\s,।!?()\\[\\]"'\\-:;])${word}(?=$|[\\s,।!?()\\[\\]"'\\-:;])`);

    // 1. Phishing / social engineering — anything asking for OTP, PIN, password, CVV
    //    or describing a scam call / SMS / link.
    const phishingCues = [
        /\bphish(?:ing)?\b/,
        /social[\s-]?engineering/,
        /\bscam\b/,
        /suspicious[\s_-]?link/,
        /fake\s+(?:call|sms|message|site|page|number|officer)/,
        /\bimpersonat/,
        /\b(?:otp|pin|password|cvv|passcode)\b/,
        /ask(?:ing|ed|s)?\s+(?:me\s+)?(?:for\s+)?(?:my\s+)?(?:otp|pin|password|cvv)/,
        /someone\s+(?:called|messaged|texted)/,
        /pretend(?:ing)?\s+to\s+be/,
        // Bangla cues
        token('ওটিপি'),     // OTP
        token('পিন'),       // PIN
        token('পাসওয়ার্ড'), // password
        /(ওটিপি|পিন|পাসওয়ার্ড)\s+চাই/, // asking for OTP/PIN/password
    ];
    if (phishingCues.some((re) => re.test(text))) {
        return CASE_TYPES.PHISHING_OR_SOCIAL_ENGINEERING;
    }

    // 2. Refund — customer wants money back / changed mind.
    const refundCues = [
        /\brefund\b/,
        /return\s+(?:my\s+)?money/,
        /\breimburse\b/,
        /\bchargeback\b/,
        /\bcancel\b.*(?:order|payment|transaction)/,
    ];
    if (refundCues.some((re) => re.test(text))) {
        return CASE_TYPES.REFUND_REQUEST;
    }

    // 3. Payment failed — transaction didn't complete, possibly balance deducted.
    const paymentFailedCues = [
        /payment\s+failed/,
        /transaction\s+failed/,
        /transaction\s+(?:did\s+not|doesn'?t)\s+(?:go\s+through|complete|work)/,
        /payment\s+declined/,
        /couldn'?t\s+pay/,
        /charge\s+failed/,
        /deducted\s+but\s+(?:not\s+)?received/,
        /balance\s+(?:was\s+)?deducted/,
        /money\s+(?:was\s+)?deducted/,
        /double\s+charge/,
    ];
    if (paymentFailedCues.some((re) => re.test(text))) {
        return CASE_TYPES.PAYMENT_FAILED;
    }

    // 4. Wrong transfer — money sent to wrong recipient.
    const wrongTransferCues = [
        /wrong\s+(?:transfer|number|account|recipient|person)/,
        /sent\s+.*\s+to\s+(?:the\s+)?wrong/,
        /incorrect\s+transfer/,
        /mistaken\s+transfer/,
        /mistakenly\s+sent/,
        /sent\s+to\s+wrong/,
        /\bby\s+mistake\b/,
        // Bangla: ভুল নম্বর / ভুল একাউন্ট / ভুল ট্রান্সফার / ভুল রিসিভার
        /ভুল\s*(?:নম্বর|একাউন্ট|ট্রান্সফার|রিসিভার)/,
    ];
    if (wrongTransferCues.some((re) => re.test(text))) {
        return CASE_TYPES.WRONG_TRANSFER;
    }

    return CASE_TYPES.OTHER;
}

//  Required Endpoint: Health Check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: "OK",
        timestamp: new Date()
    });
});

// Required Endpoint: Sort Ticket
app.post('/sort-ticket', (req, res) => {
    const { ticket_id, message, channel, locale } = req.body;

    const case_type = classifyCaseType(message);
    const severity = classifySeverity(message, case_type);
    const department = CASE_TYPE_TO_DEPARTMENT[case_type] || DEPARTMENTS.CUSTOMER_SUPPORT;
    const confidence = computeConfidence(case_type, message);
    const human_review_required = requiresHumanReview(case_type, severity);

    res.status(200).json({
        ticket_id: ticket_id || "T-001",
        case_type, // guaranteed to be one of the CASE_TYPES enum values
        severity, // guaranteed to be one of the SEVERITY enum values
        department, // guaranteed to be one of the DEPARTMENTS enum values
        agent_summary: "The system has received the ticket and it is queued for human review.",
        human_review_required, // true for phishing or critical severity
        confidence // float in [0, 1]
    });
});

// Export enums + helpers so they can be reused/imported elsewhere
export {
    CASE_TYPES, VALID_CASE_TYPES,
    DEPARTMENTS, VALID_DEPARTMENTS, CASE_TYPE_TO_DEPARTMENT,
    SEVERITY, VALID_SEVERITY,
    classifyCaseType, classifySeverity, computeConfidence, requiresHumanReview,
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
