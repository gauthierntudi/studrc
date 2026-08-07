import * as bcrypt from 'bcrypt';

/** PHP bcrypt uses $2y$ — Node bcrypt expects $2a$/$2b$ for compare. */
export function normalizeBcryptHash(hash: string): string {
  if (hash.startsWith('$2y$')) {
    return `$2b$${hash.slice(4)}`;
  }
  return hash;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, normalizeBcryptHash(passwordHash));
}

export function generateSubscriberCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
