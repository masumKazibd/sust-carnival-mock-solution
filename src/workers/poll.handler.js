import { Worker } from 'bullmq';
import { createConnection } from '../queue/connection.js';
import {
  QUEUE_POLL,
  JOB_DISCOVER,
  pollQueue,
  judgeQueue,
  JOB_JUDGE,
} from '../queue/queues.js';
import { users, submissions } from '../db/schema.js';
import { db } from '../db/client.js';
import { fetchUserStatus, chunkHandles } from '../services/codeforces.js';
import { config } from '../config.js';
import * as logger from '../util/logger.js';
import { eq } from 'drizzle-orm';

const TAG = 'poll';

export const processPoll = async (job) => {
  const handleRows = await db
    .select({ handle: users.handle })
    .from(users);

  if (handleRows.length === 0) {
    return { processed: 0 };
  }

  const handles = handleRows.map((r) => r.handle);
  const batches = chunkHandles(handles, 10);

  let newCount = 0;

  for (const batch of batches) {
    const results = await fetchUserStatus(batch);
    if (!results) continue;

    const candidates = results.filter(
      (s) =>
        s.problem?.contestId === config.contestId &&
        s.problem?.index === config.problemId &&
        s.verdict === 'OK',
    );

    for (const c of candidates) {
      const handle = c.handle || batch.find((h) => true);
      if (!handle) continue;

      const submittedAt = new Date((c.creationTimeSeconds ?? Date.now() / 1000) * 1000);

      const inserted = await db
        .insert(submissions)
        .values({
          handle,
          contestId: config.contestId,
          problemId: config.problemId,
          cfSubmissionId: c.id,
          verdict: 'PENDING',
          submittedAt,
        })
        .onConflictDoNothing({ target: submissions.cfSubmissionId })
        .returning();

      if (inserted.length > 0) {
        newCount += 1;
        const row = inserted[0];
        await judgeQueue.add(JOB_JUDGE, { submissionId: row.id }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 500 },
        });
      }
    }
  }

  logger.info(TAG, `processed ${newCount} new submission(s) (job ${job.id})`);

  return { processed: newCount };
};

export function createPollWorker() {
  const worker = new Worker(QUEUE_POLL, processPoll, {
    connection: createConnection(),
    concurrency: 1,
  });

  worker.on('completed', (job) => {
    logger.info(TAG, `job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(TAG, `job ${job?.id} failed: ${err?.message ?? err}`);
  });

  worker.on('error', (err) => {
    logger.error(TAG, `worker error: ${err?.message ?? err}`);
  });

  return worker;
}
