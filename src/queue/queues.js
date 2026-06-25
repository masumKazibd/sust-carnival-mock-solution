import { Queue } from 'bullmq';
import { redisConnection } from './connection.js';

export const QUEUE_POLL = 'cf-poll';
export const QUEUE_JUDGE = 'cf-judge';

export const JOB_DISCOVER = 'discover';
export const JOB_JUDGE = 'judge';

export const pollQueue = new Queue(QUEUE_POLL, { connection: redisConnection });
export const judgeQueue = new Queue(QUEUE_JUDGE, { connection: redisConnection });
