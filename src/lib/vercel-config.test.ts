import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type VercelConfig = {
  crons?: Array<{ path?: string; schedule?: string }>;
};

describe('Vercel deployment configuration', () => {
  it('keeps the booking repair cron compatible with the Hobby plan', async () => {
    const config = JSON.parse(
      await readFile(resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as VercelConfig;

    expect(config.crons).toEqual([
      {
        path: '/api/cron/reconcile-bookings',
        schedule: '17 3 * * *',
      },
    ]);
  });
});
