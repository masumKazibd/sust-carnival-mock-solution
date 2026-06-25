import {
  pgTable,
  text,
  timestamp,
  bigint,
  boolean,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  handle:       text('handle').primaryKey(),
  email:        text('email').notNull().unique(),
  phone:        text('phone').notNull(),
  passwordHash: text('password_hash').notNull(),
  registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
});

export const contestMembers = pgTable(
  'contest_members',
  {
    contestId: text('contest_id').notNull(),
    handle:    text('handle').notNull().references(() => users.handle, { onDelete: 'cascade' }),
    joinedAt:  timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.contestId, t.handle] }),
  }),
);

export const submissions = pgTable(
  'submissions',
  {
    id:             bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    handle:         text('handle').notNull().references(() => users.handle, { onDelete: 'cascade' }),
    contestId:      text('contest_id').notNull(),
    problemId:      text('problem_id').notNull(),
    cfSubmissionId: bigint('cf_submission_id', { mode: 'number' }).notNull().unique(),
    verdict:        text('verdict').notNull(),
    cheatingFlag:   boolean('cheating_flag').notNull().default(false),
    submittedAt:    timestamp('submitted_at', { withTimezone: true }).notNull(),
    judgedAt:       timestamp('judged_at', { withTimezone: true }),
  },
  (t) => ({
    byHandle:  index('idx_submissions_handle_contest').on(t.handle, t.contestId),
    byVerdict: index('idx_submissions_verdict').on(t.verdict),
  }),
);