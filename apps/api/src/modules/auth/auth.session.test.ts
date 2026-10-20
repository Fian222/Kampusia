import { expect, test } from 'bun:test';
import { sessionSeconds } from './auth.model';
import type { SessionRepository } from './auth.repository';
import { createDatabaseSessionStore } from './auth.session';

function fakeRepository() {
  const rows: { userId: string; tokenDigest: string; passwordFingerprint: string; expiresAt: Date }[] = [];
  const repository: SessionRepository = {
    insert: async values => { rows.push({ ...values, expiresAt: new Date(values.expiresAt) }); },
    // The store only awaits the lookup, so a plain promise stands in for the Drizzle query builder.
    findByDigest: (async (digest: string) => {
      const row = rows.find(item => item.tokenDigest === digest);
      return row && { ...row, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() };
    }) as unknown as SessionRepository['findByDigest'],
    deleteByDigest: async digest => { rows.splice(0, rows.length, ...rows.filter(item => item.tokenDigest !== digest)); },
    deleteExpired: async at => { rows.splice(0, rows.length, ...rows.filter(item => item.expiresAt > at)); },
  };
  return { rows, repository };
}

test('database session store keeps only token digests and survives a new store instance', async () => {
  const { rows, repository } = fakeRepository();
  const token = await createDatabaseSessionStore(repository).create('user-1', 'hash-1');
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.tokenDigest).not.toBe(token);
  const restarted = createDatabaseSessionStore(repository);
  const session = await restarted.get(token);
  expect(session?.userId).toBe('user-1');
  expect(restarted.matchesPassword(session!, 'hash-1')).toBe(true);
  expect(restarted.matchesPassword(session!, 'hash-2')).toBe(false);
  await restarted.revoke(token);
  expect(rows).toHaveLength(0);
  expect(await restarted.get(token)).toBeUndefined();
});

test('database session store rejects malformed and expired tokens and prunes expired rows', async () => {
  const { rows, repository } = fakeRepository();
  let now = Date.now();
  const store = createDatabaseSessionStore(repository, () => now);
  expect(await store.get('not-a-token')).toBeUndefined();
  const expiring = await store.create('user-1', 'hash');
  now += sessionSeconds * 1000 + 1;
  expect(await store.get(expiring)).toBeUndefined();
  expect(rows).toHaveLength(0);
  const stale = await store.create('user-2', 'hash');
  now += sessionSeconds * 1000 + 1;
  await store.create('user-3', 'hash');
  expect(rows.map(row => row.userId)).toEqual(['user-3']);
  expect(await store.get(stale)).toBeUndefined();
});
