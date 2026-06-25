// Integration tests — require a running Postgres + Redis (docker compose stack).
// Run via: `docker compose up postgres redis -d && npm test`.

const integrationEnabled = Boolean(process.env.DATABASE_URL) && Boolean(process.env.REDIS_URL);

const maybeDescribe = integrationEnabled ? describe : describe.skip;

maybeDescribe('register (integration)', () => {
  it.todo('runs against docker compose stack');
});

maybeDescribe('contests (integration)', () => {
  it.todo('runs against docker compose stack');
});

maybeDescribe('leaderboard (integration)', () => {
  it.todo('runs against docker compose stack');
});

maybeDescribe('submissions (integration)', () => {
  it.todo('runs against docker compose stack');
});
