import { createPollWorker } from './poll.handler.js';
import { createJudgeWorker } from './judge.handler.js';
import { pollQueue, JOB_DISCOVER } from '../queue/queues.js';
import { config } from '../config.js';
import * as logger from '../util/logger.js';

const TAG = 'worker';

async function main() {
  const pollWorker = createPollWorker();
  const judgeWorker = createJudgeWorker();

  await pollQueue.add(JOB_DISCOVER, {}, {
    repeat: { every: config.codeforcesIntervalMs },
    jobId: 'cf-poll-repeatable',
  });

  logger.info(TAG, `booted — polling every ${config.codeforcesIntervalMs}ms`);

  const shutdown = async (signal) => {
    logger.info(TAG, `received ${signal}, shutting down...`);
    try {
      await Promise.allSettled([pollWorker.close(), judgeWorker.close()]);
    } catch (err) {
      logger.error(TAG, `error during shutdown: ${err?.message ?? err}`);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(TAG, `fatal: ${err?.message ?? err}`);
  process.exit(1);
});
