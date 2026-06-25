import { VERDICTS, CF_VERDICT_MAP } from './problems.js';
import { rollCheat } from '../util/rng.js';

const READ_PATTERN = /readLine|input\s*\(\)|prompt\s*\(/i;
const SPLIT_PATTERN = /split|replace.*\+/i;
const PARSE_PATTERN = /parseInt|Number\(|parseFloat/i;
const OUTPUT_PATTERN = /console\.log|print\s*\(/i;

export function checkProblemA(source) {
  if (typeof source !== 'string') {
    return { ok: false, reason: 'pattern_mismatch' };
  }

  const hasRead = READ_PATTERN.test(source);
  const hasSplit = SPLIT_PATTERN.test(source);
  const hasParse = PARSE_PATTERN.test(source);
  const hasOutput = OUTPUT_PATTERN.test(source);

  if (hasRead && hasSplit && hasParse && hasOutput) {
    return { ok: true };
  }

  return { ok: false, reason: 'pattern_mismatch' };
}

export function verify({ problemId, source, cfVerdict }) {
  let baseVerdict;

  if (problemId === 'A') {
    const patternOk = checkProblemA(source).ok;
    if (cfVerdict === 'OK' && patternOk) {
      baseVerdict = VERDICTS.ACCEPTED;
    } else if (cfVerdict === 'OK' && !patternOk) {
      baseVerdict = VERDICTS.WRONG_ANSWER;
    } else {
      baseVerdict = CF_VERDICT_MAP[cfVerdict] ?? VERDICTS.WRONG_ANSWER;
    }
  } else {
    baseVerdict = CF_VERDICT_MAP[cfVerdict] ?? VERDICTS.WRONG_ANSWER;
  }

  let verdict = baseVerdict;
  let cheatingFlag = false;

  if (verdict === VERDICTS.ACCEPTED && rollCheat()) {
    verdict = VERDICTS.CHEATER_DETECTED;
    cheatingFlag = true;
  }

  return { verdict, cheatingFlag };
}
