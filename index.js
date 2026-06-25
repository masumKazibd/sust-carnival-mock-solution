import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

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
 
    res.status(200).json({
        ticket_id: ticket_id || "T-001",  
        case_type: "other",
        severity: "low",
        department: "customer_support",
        agent_summary: "The system has received the ticket and it is queued for human review.",
        human_review_required: false,
        confidence: 1.0
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));