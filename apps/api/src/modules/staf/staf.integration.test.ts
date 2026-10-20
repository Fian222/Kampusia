import { expect, test } from 'bun:test';
import { createDatabase } from '@kampusia/db';
import { users } from '@kampusia/db/schema';
import { eq } from 'drizzle-orm';
import { createStafRepository } from './staf.repository';
import { createStafService } from './staf.service';

test.skipIf(Bun.env.RUN_STAF_DB_TESTS !== '1')('PostgreSQL staff account queries, constraints and admin safeguards (rolled back)', async () => {
  const url = new URL(Bun.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/kampusia') throw new Error('Staff integration tests require local kampusia.');
  const { db, client } = createDatabase(url.toString());
  const rollback = new Error('Rollback staff fixtures');
  const prefix = '8' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  try {
    await expect(db.transaction(async tx => {
      const [actor] = await tx.insert(users).values({ loginId: prefix + '0', passwordHash: 'unused-test-hash', role: 'ADMIN' }).returning();
      const staf = createStafService(createStafRepository(tx));
      const actorUser = { id: actor!.id, loginId: actor!.loginId, email: null, role: 'ADMIN' as const, mustChangePassword: false };

      const created = await staf.create({ login_id: prefix + '1', role: 'AKADEMIK', email: `${prefix}@Kampusia.Test` });
      expect(created.account).toMatchObject({ loginId: prefix + '1', email: `${prefix}@kampusia.test`, role: 'AKADEMIK', isActive: true, mustChangePassword: true });
      expect(created.account).not.toHaveProperty('id');
      const [stored] = await tx.select().from(users).where(eq(users.loginId, prefix + '1'));
      expect(await Bun.password.verify(created.temporaryPassword, stored!.passwordHash)).toBe(true);

      await expect(tx.transaction(savepoint => createStafService(createStafRepository(savepoint)).create({ login_id: prefix + '1', role: 'ADMIN' }))).rejects.toThrow('Nomor Induk sudah digunakan oleh akun lain.');
      await expect(tx.transaction(savepoint => createStafService(createStafRepository(savepoint)).create({ login_id: prefix + '2', role: 'ADMIN', email: `${prefix}@kampusia.test` }))).rejects.toThrow('Email sudah digunakan oleh akun lain.');

      const listed = await staf.list({ search: prefix, role: 'AKADEMIK' });
      expect(listed.meta.total).toBe(1);
      expect(listed.data[0]).not.toHaveProperty('passwordHash');

      expect(await staf.update(actorUser, prefix + '1', { role: 'ADMIN', email: null })).toMatchObject({ role: 'ADMIN', email: null });
      expect(await staf.update(actorUser, prefix + '1', { is_active: false })).toMatchObject({ isActive: false });
      await expect(tx.transaction(savepoint => createStafService(createStafRepository(savepoint)).update(actorUser, prefix + '0', { role: 'AKADEMIK' }))).rejects.toThrow('akun Anda sendiri');

      const reset = await staf.resetPassword(actorUser, prefix + '1');
      const [afterReset] = await tx.select().from(users).where(eq(users.loginId, prefix + '1'));
      expect(afterReset!.mustChangePassword).toBe(true);
      expect(await Bun.password.verify(reset.temporaryPassword, afterReset!.passwordHash)).toBe(true);
      throw rollback;
    })).rejects.toBe(rollback);
    expect(await db.select().from(users).where(eq(users.loginId, prefix + '1'))).toHaveLength(0);
  } finally { await client.end(); }
}, 30000);
