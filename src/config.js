import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://queuestorm:queuestorm@localhost:5432/queuestorm',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  codeforcesIntervalMs: Number(process.env.CODEFORCES_INTERVAL_MS) || 5000,
  cheatProbability: Number(process.env.CHEAT_PROBABILITY) || 0.05,
  contestId: process.env.CONTEST_ID || 'qstorm-warmup-1',
  problemId: process.env.PROBLEM_ID || 'A',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
  nodeEnv: process.env.NODE_ENV || 'development',
};