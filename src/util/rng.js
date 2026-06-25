import { config } from '../config.js';

export function rollCheat(p = config.cheatProbability) {
  return Math.random() < p;
}

export function rollCheats(n, p = config.cheatProbability) {
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (rollCheat(p)) count++;
  }
  return count;
}
