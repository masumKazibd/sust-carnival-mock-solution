import express from 'express';
import dotenv from 'dotenv';
import { registerRouter } from './src/routes/register.js';
import { contestsRouter } from './src/routes/contests.js';
import { leaderboardRouter } from './src/routes/leaderboard.js';
import { submissionsRouter } from './src/routes/submissions.js';

dotenv.config();

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Preserved placeholder endpoint from the original scaffold.
app.post('/sort-ticket', (req, res) => {
  const { ticket_id, message, channel, locale } = req.body ?? {};
  res.status(200).json({
    ticket_id: ticket_id ?? 'T-001',
    case_type: 'other',
    severity: 'low',
    department: 'customer_support',
    agent_summary: 'The system has received the ticket and it is queued for human review.',
    human_review_required: false,
    confidence: 1.0,
  });
});

app.use(registerRouter);
app.use(contestsRouter);
app.use(leaderboardRouter);
app.use(submissionsRouter);

app.use((err, req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error('[api error]', err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal Server Error' });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on :${PORT}`);
});