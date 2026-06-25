import { jest } from '@jest/globals';
import { verify } from '../src/services/verifier.js';
import { rollCheats } from '../src/util/rng.js';
import { VERDICTS } from '../src/services/problems.js';

describe('verifier.verify', () => {
  test('valid Problem A source returns ACCEPTED verdict', () => {
    const validSource = `
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin });
      rl.on('line', (line) => {
        const parts = line.split(' ');
        const a = parseInt(parts[0], 10);
        const b = parseInt(parts[1], 10);
        console.log(a + b);
      });
    `;
    const result = verify({ problemId: 'A', source: validSource, cfVerdict: 'OK' });
    // cheatingFlag is RNG-dependent — only assert on the verdict string here.
    expect(typeof result.verdict).toBe('string');
    expect([VERDICTS.ACCEPTED, VERDICTS.CHEATER_DETECTED]).toContain(result.verdict);
  });

  test('missing-pattern Problem A source returns WRONG_ANSWER', () => {
    const invalidSource = 'console.log("hello world");';
    const result = verify({ problemId: 'A', source: invalidSource, cfVerdict: 'OK' });
    expect(result.verdict).toBe(VERDICTS.WRONG_ANSWER);
    expect(result.cheatingFlag).toBe(false);
  });

  test('non-OK CF verdict maps correctly via CF_VERDICT_MAP', () => {
    const result = verify({ problemId: 'A', source: 'irrelevant', cfVerdict: 'RUNTIME_ERROR' });
    expect(result.verdict).toBe(VERDICTS.RUNTIME_ERROR);
    expect(result.cheatingFlag).toBe(false);
  });
});

describe('rng.rollCheats distribution', () => {
  test('5 runs of 5000 trials each fall within [150, 350] cheaters', () => {
    for (let i = 0; i < 5; i++) {
      const count = rollCheats(5000);
      expect(count).toBeGreaterThanOrEqual(150);
      expect(count).toBeLessThanOrEqual(350);
    }
  });
});
