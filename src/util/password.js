import bcrypt from 'bcrypt';
import { config } from '../config.js';

export async function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptRounds);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
