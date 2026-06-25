import { Router } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, submissions } from '../db/schema.js';

const router = Router();

router.get('/users/:handle/submissions', async (req, res, next) => {
  try {
    const handle = req.params.handle.trim().toLowerCase();

    const [user] = await db
      .select({ handle: users.handle })
      .from(users)
      .where(eq(users.handle, handle))
      .limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const contestIdRaw = req.query.contest_id;
    const contestId = typeof contestIdRaw === 'string' && contestIdRaw.length > 0 ? contestIdRaw : null;

    let limit = Number.parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 50;
    if (limit > 200) limit = 200;

    let offset = Number.parseInt(req.query.offset, 10);
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    const whereClause = contestId
      ? and(eq(submissions.handle, handle), eq(submissions.contestId, contestId))
      : eq(submissions.handle, handle);

    const [totalRow] = await db
      .select({ count: sql`COUNT(*)`.as('count') })
      .from(submissions)
      .where(whereClause);

    const rows = await db
      .select({
        id: submissions.id,
        contestId: submissions.contestId,
        problemId: submissions.problemId,
        verdict: submissions.verdict,
        cheatingFlag: submissions.cheatingFlag,
        submittedAt: submissions.submittedAt,
        judgedAt: submissions.judgedAt,
        cfSubmissionId: submissions.cfSubmissionId,
      })
      .from(submissions)
      .where(whereClause)
      .orderBy(desc(submissions.submittedAt))
      .limit(limit)
      .offset(offset);

    const mapped = rows.map((row) => ({
      id: row.id,
      contest_id: row.contestId,
      problem_id: row.problemId,
      verdict: row.verdict,
      cheating_flag: row.cheatingFlag,
      submitted_at:
        row.submittedAt instanceof Date ? row.submittedAt.toISOString() : row.submittedAt,
      judged_at:
        row.judgedAt == null
          ? null
          : row.judgedAt instanceof Date
          ? row.judgedAt.toISOString()
          : row.judgedAt,
      cf_submission_id: row.cfSubmissionId,
    }));

    return res.status(200).json({
      submissions: mapped,
      total: Number(totalRow.count) || 0,
    });
  } catch (err) {
    next(err);
  }
});

export const submissionsRouter = router;