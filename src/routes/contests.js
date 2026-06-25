import { Router } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, contestMembers } from '../db/schema.js';
import { verifyPassword } from '../util/password.js';

const router = Router();

const joinSchema = z.object({
  handle: z.string().min(1),
  password: z.string().min(1),
});

router.post('/contests/:contest_id/join', async (req, res, next) => {
  try {
    const parse = joinSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid input', details: parse.error.issues });
    }

    const contestId = req.params.contest_id;
    const handle = parse.data.handle.trim().toLowerCase();
    const { password } = parse.data;

    const [user] = await db.select().from(users).where(eq(users.handle, handle)).limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const inserted = await db
      .insert(contestMembers)
      .values({ contestId, handle })
      .onConflictDoNothing()
      .returning({
        handle: contestMembers.handle,
        contestId: contestMembers.contestId,
        joinedAt: contestMembers.joinedAt,
      });

    let row = inserted[0];
    if (!row) {
      // Already a member — fetch existing row to get original joinedAt.
      const [existing] = await db
        .select({
          handle: contestMembers.handle,
          contestId: contestMembers.contestId,
          joinedAt: contestMembers.joinedAt,
        })
        .from(contestMembers)
        .where(and(eq(contestMembers.contestId, contestId), eq(contestMembers.handle, handle)))
        .limit(1);
      row = existing;
    }

    const joinedAtIso = row.joinedAt instanceof Date
      ? row.joinedAt.toISOString()
      : new Date(row.joinedAt).toISOString();

    return res.status(200).json({
      handle: row.handle,
      contest_id: row.contestId,
      joined_at: joinedAtIso,
    });
  } catch (err) {
    next(err);
  }
});

export const contestsRouter = router;