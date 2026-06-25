import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../util/password.js';

const router = Router();

const registerSchema = z.object({
  handle: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  password: z.string().min(1),
});

router.post('/register', async (req, res, next) => {
  try {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid input', details: parse.error.issues });
    }

    const handle = parse.data.handle.trim().toLowerCase();
    const { email, phone, password } = parse.data;
    const passwordHash = await hashPassword(password);

    try {
      const [row] = await db
        .insert(users)
        .values({ handle, email, phone, passwordHash })
        .returning({ handle: users.handle, registeredAt: users.registeredAt });

      return res.status(201).json({
        handle: row.handle,
        registered_at: row.registeredAt.toISOString(),
      });
    } catch (err) {
      if (err && err.code === '23505') {
        return res.status(409).json({ error: 'Conflict: handle or email already exists' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

export const registerRouter = router;