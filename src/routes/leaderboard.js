import { Router } from 'express';
import { sql, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { submissions } from '../db/schema.js';

const router = Router();

router.get('/contests/:contest_id/leaderboard', async (req, res, next) => {
  try {
    const contestId = req.params.contest_id;

    const acceptedExpr = sql`COUNT(*) FILTER (WHERE ${submissions.verdict} = 'ACCEPTED')`;
    const cheatedExpr = sql`COUNT(*) FILTER (WHERE ${submissions.cheatingFlag} = true)`;
    const earliestAcceptedExpr = sql`MIN(${submissions.judgedAt}) FILTER (WHERE ${submissions.verdict} = 'ACCEPTED')`;

    const rows = await db
      .select({
        handle: submissions.handle,
        accepted: acceptedExpr.as('accepted'),
        cheated: cheatedExpr.as('cheated'),
        earliest_accepted: earliestAcceptedExpr.as('earliest_accepted'),
      })
      .from(submissions)
      .where(eq(submissions.contestId, contestId))
      .groupBy(submissions.handle)
      .orderBy(
        sql`${acceptedExpr} DESC`,
        sql`${earliestAcceptedExpr} ASC`,
      )
      .limit(100);

    const result = rows.map((row, idx) => ({
      rank: idx + 1,
      handle: row.handle,
      score: Number(row.accepted) || 0,
      accepted: Number(row.accepted) || 0,
      cheated: Number(row.cheated) || 0,
    }));

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const leaderboardRouter = router;