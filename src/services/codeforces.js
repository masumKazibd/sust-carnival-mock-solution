import axios from 'axios';
import * as logger from '../util/logger.js';

const BASE_URL = 'https://codeforces.com/api/user.status';
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;
const TAG = 'codeforces';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunkHandles(handles, size = 10) {
  if (!Array.isArray(handles)) {
    return [];
  }
  const chunks = [];
  for (let i = 0; i < handles.length; i += size) {
    chunks.push(handles.slice(i, i + size));
  }
  return chunks;
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status < 600);
}

function isRetryableError(err) {
  if (!err.response) {
    return true;
  }
  return isRetryableStatus(err.response.status);
}

export async function fetchUserStatus(handles, { from = 1, count = 100 } = {}) {
  if (!Array.isArray(handles) || handles.length === 0) {
    return [];
  }

  const joined = handles.join(';');
  const url = `${BASE_URL}?handles=${encodeURIComponent(joined)}&from=${from}&count=${count}`;

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await axios.get(url, { timeout: 15000 });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Unexpected status ${response.status}`);
      }

      const data = response.data;
      if (data && data.status === 'OK' && Array.isArray(data.result)) {
        return data.result;
      }

      // Codeforces returns 200 with status:"FAILED" for things like bad handles
      throw new Error(`Codeforces API returned non-OK status: ${data?.status ?? 'unknown'}`);
    } catch (err) {
      lastError = err;
      const status = err.response?.status;

      // Non-retryable status — likely a bug (bad request, forbidden, etc.)
      if (status && !isRetryableStatus(status)) {
        throw err;
      }

      // Network error (no response) or retryable status — back off
      if (attempt < MAX_ATTEMPTS) {
        const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
        logger.warn(
          TAG,
          `fetchUserStatus attempt ${attempt}/${MAX_ATTEMPTS} failed (${err.message}); retrying in ${delay}ms`,
        );
        await sleep(delay);
      }
    }
  }

  logger.error(
    TAG,
    `fetchUserStatus giving up after ${MAX_ATTEMPTS} attempts: ${lastError?.message ?? 'unknown error'}`,
  );
  return null;
}