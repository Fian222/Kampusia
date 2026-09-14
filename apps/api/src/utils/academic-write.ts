import { MasterDataError } from './master-data';

export function postgresError(error: unknown) {
  let cause = error;
  for (let depth = 0; depth < 6 && cause && typeof cause === 'object'; depth++) {
    if ('code' in cause && typeof cause.code === 'string') return { code: cause.code, constraint: 'constraint_name' in cause ? cause.constraint_name : undefined };
    cause = 'cause' in cause ? cause.cause : undefined;
  }
  return undefined;
}

// Retry the complete transaction, including all validation reads.
export async function academicWrite<T>(operation: () => Promise<T>): Promise<T> {
  const duplicates: Record<string, string> = {
    ruangan_kode_unique: 'Kode ruangan sudah digunakan.',
    jadwal_kuliah_kelas_kuliah_id_hari_jam_mulai_jam_selesai_unique: 'Jadwal kelas pada waktu tersebut sudah ada.',
    semester_kode_unique: 'Kode semester sudah digunakan.',
    semester_tahun_mulai_jenis_unique: 'Tahun mulai dan jenis semester sudah digunakan.',
    semester_active_unique: 'Semester aktif berubah bersamaan. Silakan coba lagi.',
    kelas_kuliah_offering_unique: 'Kelas dengan semester, program studi, mata kuliah, dan nama yang sama sudah ada.',
    kelas_dosen_kelas_kuliah_id_dosen_id_unique: 'Dosen sudah ditugaskan pada kelas ini.',
    kelas_dosen_koordinator_unique: 'Kelas hanya boleh memiliki satu koordinator.',
    pertemuan_kelas_kuliah_id_nomor_pertemuan_unique: 'Nomor pertemuan sudah digunakan pada kelas ini, termasuk oleh pertemuan yang dibatalkan.',
    absensi_pertemuan_id_mahasiswa_id_unique: 'Absensi mahasiswa pada pertemuan ini sudah tercatat.',
  };
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      const pg = postgresError(error);
      if (pg && ['40001', '40P01'].includes(pg.code)) {
        if (attempt < 2) continue;
        throw new MasterDataError(409, 'Data berubah bersamaan. Silakan coba lagi.');
      }
      if (pg?.code === '23505' && typeof pg.constraint === 'string' && duplicates[pg.constraint]) throw new MasterDataError(409, duplicates[pg.constraint]!);
      throw error;
    }
  }
}
