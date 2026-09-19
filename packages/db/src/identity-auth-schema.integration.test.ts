import { expect, test } from 'bun:test';
import { inArray, sql, type SQL } from 'drizzle-orm';
import { dosen, mahasiswa, users } from '../schema';
import { createDatabase } from './index';

const enabled = Bun.env.RUN_IDENTITY_AUTH_DB_TESTS === '1';

test.skipIf(!enabled)('PostgreSQL identity-number authentication schema and fixture backfill match the migration contract (rolled back)', async () => {
  const url = new URL(Bun.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/kampusia') {
    throw new Error('Identity authentication database tests require the local kampusia database.');
  }

  const { db, client } = createDatabase(url.toString());
  const rollback = new Error('Rollback identity authentication schema fixtures');
  const randomDigits = String(crypto.getRandomValues(new Uint32Array(1))[0]).padStart(10, '0');
  const digits = `${Date.now()}${randomDigits}`.slice(0, 29);
  const leadingZeroLogin = `0${digits}`;
  const emailPrefix = `identity-${crypto.randomUUID().slice(0, 12)}`;

  try {
    await expect(db.transaction(async (tx) => {
      const expectRejected = async (statement: SQL) => {
        await expect(tx.transaction((savepoint) => savepoint.execute(statement))).rejects.toThrow();
      };

      const columns = await tx.execute(sql<{
        table_name: string;
        column_name: string;
        is_nullable: string;
        data_type: string;
        character_maximum_length: number;
      }>`
        select table_name, column_name, is_nullable, data_type, character_maximum_length
        from information_schema.columns
        where table_schema = 'public'
          and (table_name, column_name) in (
            ('users', 'login_id'),
            ('users', 'email'),
            ('dosen', 'nik')
          )
        order by table_name, column_name
      `);
      expect(columns.map((row) => ({
        table_name: row.table_name,
        column_name: row.column_name,
        is_nullable: row.is_nullable,
        data_type: row.data_type,
        character_maximum_length: row.character_maximum_length,
      }))).toEqual([
        { table_name: 'dosen', column_name: 'nik', is_nullable: 'YES', data_type: 'character varying', character_maximum_length: 30 },
        { table_name: 'users', column_name: 'email', is_nullable: 'YES', data_type: 'character varying', character_maximum_length: 254 },
        { table_name: 'users', column_name: 'login_id', is_nullable: 'YES', data_type: 'character varying', character_maximum_length: 30 },
      ]);

      const constraints = await tx.execute(sql<{ conname: string }>`
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public' and t.relname in ('users', 'dosen')
      `);
      const names = constraints.map((row) => row.conname);
      for (const name of [
        'users_login_id_unique',
        'users_login_id_digits_check',
        'users_email_unique',
        'dosen_nik_unique',
        'dosen_nik_digits_check',
      ]) expect(names).toContain(name);

      const insertedUsers = await tx.insert(users).values([
        { loginId: leadingZeroLogin, email: `${emailPrefix}-one@example.test`, passwordHash: 'unused-test-hash', role: 'ADMIN' },
        { loginId: null, email: null, passwordHash: 'unused-test-hash', role: 'AKADEMIK' },
        { loginId: null, email: null, passwordHash: 'unused-test-hash', role: 'MAHASISWA' },
      ]).returning({ loginId: users.loginId, email: users.email });
      expect(insertedUsers).toEqual([
        { loginId: leadingZeroLogin, email: `${emailPrefix}-one@example.test` },
        { loginId: null, email: null },
        { loginId: null, email: null },
      ]);

      await expectRejected(sql`
        insert into users (login_id, email, password_hash, role)
        values (${leadingZeroLogin}, ${`${emailPrefix}-two@example.test`}, 'unused-test-hash', 'ADMIN')
      `);
      await expectRejected(sql`
        insert into users (login_id, email, password_hash, role)
        values ('ABC123', ${`${emailPrefix}-alpha@example.test`}, 'unused-test-hash', 'ADMIN')
      `);
      await expectRejected(sql`
        insert into users (login_id, email, password_hash, role)
        values ('123X456', ${`${emailPrefix}-mixed@example.test`}, 'unused-test-hash', 'ADMIN')
      `);
      await expectRejected(sql`
        insert into users (email, password_hash, role)
        values (${`${emailPrefix}-one@example.test`}, 'unused-test-hash', 'ADMIN')
      `);

      const lecturerCode = `IDENTITY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const [leadingZeroLecturer] = await tx.insert(dosen).values({
        nik: leadingZeroLogin,
        kodeDosen: lecturerCode,
        nama: 'Identity Test Lecturer',
      }).returning({ nik: dosen.nik });
      expect(leadingZeroLecturer?.nik).toBe(leadingZeroLogin);
      const [nullableLecturer] = await tx.insert(dosen).values({
        nik: null,
        kodeDosen: `${lecturerCode}-NULL`,
        nama: 'Nullable Identity Test Lecturer',
      }).returning({ nik: dosen.nik });
      expect(nullableLecturer?.nik).toBeNull();
      const [secondNullableLecturer] = await tx.insert(dosen).values({
        nik: null,
        kodeDosen: `${lecturerCode}-NULL2`,
        nama: 'Second Nullable Identity Test Lecturer',
      }).returning({ nik: dosen.nik });
      expect(secondNullableLecturer?.nik).toBeNull();
      await expectRejected(sql`
        insert into dosen (nik, kode_dosen, nama)
        values (${leadingZeroLogin}, ${`${lecturerCode}-DUP`}, 'Duplicate Identity Test Lecturer')
      `);
      await expectRejected(sql`
        insert into dosen (nik, kode_dosen, nama)
        values ('NIK123', ${`${lecturerCode}-ALPHA`}, 'Alphabetic Identity Test Lecturer')
      `);
      await expectRejected(sql`
        insert into dosen (nik, kode_dosen, nama)
        values ('123-456', ${`${lecturerCode}-MIXED`}, 'Mixed Identity Test Lecturer')
      `);

      const fixtureUserIds = [
        '20260000-0000-4000-8000-000100000001',
        '20260000-0000-4000-8000-000100000002',
        '20260000-0000-4000-8000-000100000003',
        '20260000-0000-4000-8000-000100000004',
      ] as const;
      const fixtureUsers = await tx.select({ id: users.id, loginId: users.loginId, role: users.role })
        .from(users).where(inArray(users.id, fixtureUserIds));
      if (fixtureUsers.length > 0) {
        expect(fixtureUsers.sort((a, b) => a.id.localeCompare(b.id))).toEqual([
          { id: fixtureUserIds[0]!, loginId: '99000002', role: 'AKADEMIK' },
          { id: fixtureUserIds[1]!, loginId: '99000001', role: 'ADMIN' },
          { id: fixtureUserIds[2]!, loginId: '99000003', role: 'DOSEN' },
          { id: fixtureUserIds[3]!, loginId: '99202601', role: 'MAHASISWA' },
        ]);
        const fixtureStudents = await tx.select({ id: mahasiswa.id, nim: mahasiswa.nim })
          .from(mahasiswa).where(inArray(mahasiswa.id, [
            '20260000-0000-4000-8000-000900000001',
            '20260000-0000-4000-8000-000900000002',
            '20260000-0000-4000-8000-000900000003',
            '20260000-0000-4000-8000-000900000004',
            '20260000-0000-4000-8000-000900000005',
          ])).orderBy(mahasiswa.id);
        expect(fixtureStudents.map((row) => row.nim)).toEqual([
          '99202601', '99202602', '99202603', '99202604', '99202605',
        ]);
        const [fixtureLecturer] = await tx.select({ nik: dosen.nik }).from(dosen)
          .where(sql`${dosen.id} = '20260000-0000-4000-8000-000800000001'::uuid`);
        expect(fixtureLecturer?.nik).toBe('99000003');
      }

      throw rollback;
    })).rejects.toBe(rollback);
  } finally {
    await client.end();
  }
});
