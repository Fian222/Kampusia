import { expect, test } from 'bun:test';
import { createDatabase } from '@kampusia/db';
import { createFakultasRepository } from './fakultas/fakultas.repository';
import { createFakultasService } from './fakultas/fakultas.service';
import { createProgramStudiRepository } from './program-studi/program-studi.repository';
import { createProgramStudiService } from './program-studi/program-studi.service';

test.skipIf(Bun.env.RUN_MASTER_DB_TESTS !== '1')('PostgreSQL master-data queries, constraints and historical retention (rolled back)', async () => {
  const url = new URL(Bun.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/kampusia') throw new Error('Master-data integration tests require local kampusia.');
  const { db, client } = createDatabase(url.toString());
  const rollback = new Error('Rollback test fixtures');
  const prefix = 'T' + crypto.randomUUID().slice(0, 8).toUpperCase();
  try {
    await expect(db.transaction(async tx => {
      const faculties = createFakultasService(createFakultasRepository(tx));
      const programs = createProgramStudiService(createProgramStudiRepository(tx));
      const faculty = await faculties.create({ kode: ' ' + prefix.toLowerCase() + ' ', nama: prefix + ' Teknik' });
      const inactive = await faculties.create({ kode: prefix + 'B', nama: prefix + ' Nonaktif', is_active: false });
      const literal = await faculties.create({ kode: prefix + '_%', nama: prefix + ' Literal' });
      expect(faculty.kode).toBe(prefix);
      const page = await faculties.list({ search: prefix, limit: 1, page: 2 });
      expect(page.meta.total).toBe(3); expect(page.data).toHaveLength(1);
      expect((await faculties.list({ search: prefix, is_active: 'false' })).data.map(row => row.id)).toEqual([inactive.id]);
      expect((await faculties.list({ search: prefix + '_%' })).data.map(row => row.id)).toEqual([literal.id]);
      await expect(tx.transaction(savepoint => createFakultasService(createFakultasRepository(savepoint)).create({ kode: prefix.toLowerCase(), nama: 'Duplicate' }))).rejects.toThrow('Kode fakultas sudah digunakan.');
      const first = await programs.create({ kode: prefix + 'P1', nama: prefix + ' Informatika', fakultas_id: faculty.id, jenjang: 'S1' });
      const second = await programs.create({ kode: prefix + 'P2', nama: prefix + ' Informatika', fakultas_id: faculty.id, jenjang: 'S1' });
      await programs.create({ kode: prefix + 'P3', nama: prefix + ' Informatika', fakultas_id: faculty.id, jenjang: 'S2', is_active: false });
      const programPage = await programs.list({ search: prefix, fakultas_id: faculty.id, jenjang: 'S1', is_active: 'true', limit: 1, page: 2 });
      expect(programPage.meta.total).toBe(2); expect(programPage.data[0]?.id).toBe(second.id);
      expect(programPage.data[0]?.fakultas.nama).toBe(faculty.nama);
      await expect(programs.create({ kode: first.kode.toLowerCase(), nama: 'Duplicate', fakultas_id: faculty.id, jenjang: 'S3' })).rejects.toThrow('Kode program studi sudah digunakan.');
      await expect(programs.update(second.id, { kode: first.kode.toLowerCase() })).rejects.toThrow('Kode program studi sudah digunakan.');
      await expect(programs.create({ kode: prefix + 'BAD', nama: 'Invalid', fakultas_id: crypto.randomUUID(), jenjang: 'S1' })).rejects.toThrow('Fakultas tidak ditemukan.');
      await expect(programs.create({ kode: prefix + 'BAD', nama: 'Invalid', fakultas_id: inactive.id, jenjang: 'S1' })).rejects.toThrow('fakultas aktif');
      const updated = await programs.update(first.id, { nama: 'Koreksi', jenjang: 'D4' });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
      await faculties.update(faculty.id, { is_active: false });
      await expect(programs.create({ kode: prefix + 'BAD', nama: 'Invalid', fakultas_id: faculty.id, jenjang: 'S1' })).rejects.toThrow('fakultas aktif');
      await programs.update(first.id, { nama: 'Riwayat', is_active: false });
      const historical = await programs.get(first.id);
      expect(historical.isActive).toBe(false); expect(historical.fakultas.isActive).toBe(false);
      expect((await programs.list({ search: prefix })).meta.total).toBe(3);
      throw rollback;
    })).rejects.toBe(rollback);
    expect((await createFakultasRepository(db).list({ search: prefix })).meta.total).toBe(0);
  } finally { await client.end(); }
}, 20000);
