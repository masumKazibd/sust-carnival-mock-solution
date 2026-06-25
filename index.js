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

// Classify ticket message into one of the enum values
function classifyCaseType(message = '') {
    const text = String(message).toLowerCase();

    if (/(phish|social engineering|scam|suspicious link|fake|impersonat)/.test(text)) {
        return CASE_TYPES.PHISHING_OR_SOCIAL_ENGINEERING;
    }
    if (/(refund|return my money|reimburse)/.test(text)) {
        return CASE_TYPES.REFUND_REQUEST;
    }
    if (/(payment failed|transaction failed|payment declined|couldn't pay|charge failed)/.test(text)) {
        return CASE_TYPES.PAYMENT_FAILED;
    }
    if (/(wrong transfer|wrong account|incorrect transfer|mistaken transfer|sent to wrong)/.test(text)) {
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
    const department = CASE_TYPE_TO_DEPARTMENT[case_type] || DEPARTMENTS.CUSTOMER_SUPPORT;

    res.status(200).json({
        ticket_id: ticket_id || "T-001",
        case_type, // guaranteed to be one of the CASE_TYPES enum values
        severity: "low",
        department, // guaranteed to be one of the DEPARTMENTS enum values
        agent_summary: "The system has received the ticket and it is queued for human review.",
        human_review_required: false,
        confidence: 1.0
    });
});

// Export enums so they can be reused/imported elsewhere
export { CASE_TYPES, VALID_CASE_TYPES, DEPARTMENTS, VALID_DEPARTMENTS, CASE_TYPE_TO_DEPARTMENT };

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
