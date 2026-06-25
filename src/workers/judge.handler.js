import { Worker } from 'bullmq';
import { createConnection } from '../queue/connection.js';
import { QUEUE_JUDGE, JOB_JUDGE } from '../queue/queues.js';
import { submissions } from '../db/schema.js';
import { db } from '../db/client.js';
import { verify } from '../services/verifier.js';
import * as logger from '../util/logger.js';
import { eq, sql } from 'drizzle-orm';
import { config } from '../config.js';

const TAG = 'judge';

export const processJudge = async (job) => {
  const { submissionId } = job.data;

  const rows = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);

  const submission = rows[0];
  if (!submission) {
    logger.warn(TAG, `submission ${submissionId} not found (job ${job.id})`);
    return;
  }

  const { verdict, cheatingFlag } = verify({
    problemId: submission.problemId ?? config.problemId,
    source: '',
    cfVerdict: submission.verdict === 'PENDING' ? 'OK' : submission.verdict,
  });

  await db
    .update(submissions)
    .set({
      verdict,
      cheatingFlag,
      judgedAt: sql`now()`,
    })
    .where(eq(submissions.id, submissionId));

  logger.info(
    TAG,
    `submission ${submissionId} judged: ${verdict}${cheatingFlag ? ' (cheating)' : ''}`,
  );

  return { verdict, cheatingFlag };
};

export function createJudgeWorker() {
  const worker = new Worker(QUEUE_JUDGE, processJudge, {
    connection: createConnection(),
    concurrency: 4,
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
