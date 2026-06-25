import { jest } from '@jest/globals';
import nock from 'nock';
import { fetchUserStatus } from '../src/services/codeforces.js';

afterEach(() => {
  nock.cleanAll();
});

describe('codeforces.fetchUserStatus', () => {
  test('returns result array on 200 OK', async () => {
    const fakeResult = [
      { id: 1, handle: 'tourist', verdict: 'OK' },
      { id: 2, handle: 'tourist', verdict: 'WRONG_ANSWER' },
    ];
    nock('https://codeforces.com')
      .get('/api/user.status')
      .query(true)
      .reply(200, { status: 'OK', result: fakeResult });

    const result = await fetchUserStatus(['tourist']);
    expect(result).toEqual(fakeResult);
  });

  test('retries on 429 then succeeds on 200', async () => {
    const fakeResult = [{ id: 99, handle: 'tourist', verdict: 'OK' }];
    nock('https://codeforces.com')
      .get('/api/user.status')
      .query(true)
      .reply(429, 'rate limited');
    nock('https://codeforces.com')
      .get('/api/user.status')
      .query(true)
      .reply(429, 'rate limited');
    nock('https://codeforces.com')
      .get('/api/user.status')
      .query(true)
      .reply(200, { status: 'OK', result: fakeResult });

    const result = await fetchUserStatus(['tourist']);
    expect(result).toEqual(fakeResult);
  });

  test('returns null after exhausting retries on 500', async () => {
    nock('https://codeforces.com')
      .get('/api/user.status')
      .query(true)
      .reply(500, 'server error');
    nock('https://codeforces.com')
      .get('/api/user.status')
      .query(true)
      .reply(500, 'server error');
    nock('https://codeforces.com')
      .get('/api/user.status')
      .query(true)
      .reply(500, 'server error');

    const result = await fetchUserStatus(['tourist']);
    expect(result).toBeNull();
  });
});
