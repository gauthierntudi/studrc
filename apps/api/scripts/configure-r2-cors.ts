/**
 * Configure CORS R2 pour autoriser les PUT navigateur (presigned uploads).
 *
 * Usage:
 *   pnpm --filter @opt1mum/api exec tsx scripts/configure-r2-cors.ts
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import {
  createR2ClientFromEnv,
  putR2BucketCors,
} from '../src/storage/r2';

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../.env'), override: true });

async function main() {
  const r2 = createR2ClientFromEnv();
  if (!r2) {
    throw new Error(
      'Config R2 incomplète (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)',
    );
  }

  const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
  const extra = (process.env.R2_CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const origins = [
    appUrl,
    'https://studrc.com',
    'https://www.studrc.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...extra,
  ];

  await putR2BucketCors(r2, origins);
  console.log(`CORS R2 configuré sur bucket « ${r2.bucket} »`);
  console.log(`Origins :\n  - ${[...new Set(origins)].join('\n  - ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
