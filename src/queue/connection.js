import IORedis from 'ioredis';
import { config } from '../config.js';

/**
 * Shared ioredis connection used by BullMQ Queue producers (and Workers, per
 * BullMQ best practice). For Workers that need their own connection
 * (e.g. to isolate blocking commands), use `createConnection()`.
 */
export const redisConnection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

redisConnection.on('error', (e) => console.error('[redis]', e.message));

/**
 * Factory that returns a new IORedis instance configured identically to the
 * shared connection. Useful for BullMQ Workers that should not share state
 * with the producer queues.
 */
export function createConnection() {
  return new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
}
