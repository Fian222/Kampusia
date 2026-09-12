import { expect, test } from 'bun:test';
import { createDatabase } from '@kampusia/db';
import { fakultas, programStudi, mahasiswa, semester, kelasKuliah } from '@kampusia/db/schema';
import { eq } from 'drizzle-orm';
import { createMataKuliahRepository } from './mata-kuliah/mata-kuliah.repository';
import { createMataKuliahService } from './mata-kuliah/mata-kuliah.service';
import { createKurikulumRepository } from './kurikulum/kurikulum.repository';
import { createKurikulumService } from './kurikulum/kurikulum.service';
import { createKurikulumMatkulRepository } from './kurikulum-matkul/kurikulum-matkul.repository';
import { createKurikulumMatkulService } from './kurikulum-matkul/kurikulum-matkul.service';

test.skipIf(Bun.env.RUN_CATALOG_DB_TESTS !== '1')('PostgreSQL catalog queries, constraints, historical guards and rollback', async () => {
  const url = new URL(Bun.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/kampusia') throw new Error('Catalog integration tests require local kampusia.');
  const { db, client } = createDatabase(url.toString());
  const rollback = new Error('Rollback catalog fixtures');
  const prefix = 'T' + crypto.randomUUID().slice(0, 8).toUpperCase();
  try {
    await expect(db.transaction(async tx => {
      const [faculty] = await tx.insert(fakultas).values({ kode: prefix, nama: prefix }).returning();
      const programs = await tx.insert(programStudi).values([
        { fakultasId: faculty!.id, kode: prefix + 'A', nama: prefix, jenjang: 'S1' as const },
        { fakultasId: faculty!.id, kode: prefix + 'B', nama: prefix, jenjang: 'S1' as const },
      ]).returning();
      const courses = createMataKuliahService(createMataKuliahRepository(tx));
      const curricula = createKurikulumService(createKurikulumRepository(tx));
      const members = createKurikulumMatkulService(createKurikulumMatkulRepository(tx));
      const a = await courses.create({ kode: ' ' + prefix.toLowerCase() + 'a ', nama: prefix + ' Course', sks: 3 });
      const b = await courses.create({ kode: prefix + 'B', nama: prefix + ' Course', sks: 4 });
      const literal = await courses.create({ kode: prefix + '_%', nama: prefix, sks: 1 });
      expect(a.kode).toBe(prefix + 'A');
      await expect(courses.create({ kode: a.kode.toLowerCase(), nama: 'Duplicate', sks: 3 })).rejects.toThrow('Kode mata kuliah sudah digunakan');
      await expect(courses.update(b.id, { kode: a.kode })).rejects.toThrow('Kode mata kuliah sudah digunakan');
      expect(() => courses.update(b.id, { sks: 0 })).toThrow('SKS');
      await courses.update(b.id, { sks: 5, is_active: false });
      expect((await courses.list({ search: prefix, limit: 1, page: 2 })).meta).toEqual({ page: 2, limit: 1, total: 3 });
      expect((await courses.list({ search: prefix + '_%' })).data[0]?.id).toBe(literal.id);
      expect((await courses.list({ search: prefix, is_active: 'false' })).data[0]?.id).toBe(b.id);
      await courses.update(b.id, { is_active: true });
      const body = { kode: prefix + 'A', nama: prefix + ' Curriculum', program_studi_id: programs[0]!.id, tahun_berlaku: 2026 };
      const curriculum = await curricula.create(body);
      const next = await curricula.create({ ...body, kode: prefix + 'B' });
      await curricula.create({ ...body, program_studi_id: programs[1]!.id });
      await expect(curricula.create(body)).rejects.toThrow('Kode kurikulum dalam program studi sudah digunakan');
      await expect(curricula.update(next.id, { kode: curriculum.kode })).rejects.toThrow('Kode kurikulum');
      const page = await curricula.list({ search: prefix, program_studi_id: programs[0]!.id, tahun_berlaku: 2026, is_active: 'true', page: 2, limit: 1 });
      expect(page.meta).toEqual({ page: 2, limit: 1, total: 2 }); expect(page.data[0]?.id).toBe(next.id);
      expect((await curricula.get(curriculum.id)).programStudi.id).toBe(programs[0]!.id);
      const membership = await members.add(curriculum.id, { mata_kuliah_id: a.id });
      await expect(members.add(curriculum.id, { mata_kuliah_id: a.id })).rejects.toThrow('sudah digunakan');
      await expect(courses.update(a.id, { sks: 4 })).rejects.toThrow('Identitas dan SKS');
      await members.update(curriculum.id, membership.id, { semester_rekomendasi: 3, is_wajib: false });
      const list = await members.list(curriculum.id, { search: prefix, limit: 1 });
      expect(list.meta.total).toBe(1); expect(list.data[0]?.mataKuliah.sks).toBe(3); expect(list.data[0]?.isWajib).toBe(false);
      await members.remove(curriculum.id, membership.id);
      expect((await members.list(curriculum.id, {})).meta.total).toBe(0);
      const retained = await members.add(curriculum.id, { mata_kuliah_id: a.id });
      await tx.insert(mahasiswa).values({ nim: prefix, nama: prefix, programStudiId: programs[0]!.id, kurikulumId: curriculum.id, angkatan: 2026, status: 'LULUS' });
      await expect(members.remove(curriculum.id, retained.id)).rejects.toThrow('sudah digunakan mahasiswa');
      await expect(members.update(curriculum.id, retained.id, { is_wajib: false })).rejects.toThrow('sudah digunakan mahasiswa');
      await expect(members.add(curriculum.id, { mata_kuliah_id: b.id })).rejects.toThrow('sudah digunakan mahasiswa');
      await expect(curricula.update(curriculum.id, { program_studi_id: programs[1]!.id })).rejects.toThrow('memiliki mahasiswa');
      for (const is_active of [false, true]) await curricula.update(curriculum.id, { is_active });
      const offeringMember = await members.add(next.id, { mata_kuliah_id: b.id });
      // Reuse a term when available; the test never changes its configuration.
      let term = (await tx.select({ id: semester.id }).from(semester).limit(1))[0];
      if (!term) [term] = await tx.insert(semester).values({ kode: '99981', nama: prefix, tahunMulai: 9998, jenis: 'GANJIL', tanggalMulai: '9998-01-01', tanggalSelesai: '9998-06-01' }).returning({ id: semester.id });
      await tx.insert(kelasKuliah).values({ semesterId: term!.id, mataKuliahId: b.id, programStudiId: programs[0]!.id, namaKelas: prefix, kapasitas: 30 });
      await expect(members.remove(next.id, offeringMember.id)).rejects.toThrow('riwayat kelas');
      await expect(curricula.update(next.id, { tahun_berlaku: 2027 })).rejects.toThrow('riwayat kelas');
      await expect(courses.update(b.id, { nama: 'Changed' })).rejects.toThrow('Identitas dan SKS');
      await tx.update(programStudi).set({ isActive: false }).where(eq(programStudi.id, programs[0]!.id));
      await expect(curricula.create({ ...body, kode: prefix + 'C' })).rejects.toThrow('program studi aktif');
      await courses.update(literal.id, { is_active: false });
      await expect(members.add(next.id, { mata_kuliah_id: literal.id })).rejects.toThrow('nonaktif');
      throw rollback;
    })).rejects.toBe(rollback);
    expect((await createMataKuliahRepository(db).list({ search: prefix })).meta.total).toBe(0);
    expect((await createKurikulumRepository(db).list({ search: prefix })).meta.total).toBe(0);
  } finally { await client.end(); }
}, 20000);
