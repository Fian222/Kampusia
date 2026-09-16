import type * as schema from '../schema';

// Fixed UUIDs identify this development fixture without relying on business identifiers as PKs.
const id = (group: number, item = 1) => `20260000-0000-4000-8000-${String(group).padStart(4, '0')}${String(item).padStart(8, '0')}`;
export const demoUsers = {
  // Keep AKADEMIK first: its original UUID remains the seed-completeness anchor.
  AKADEMIK: { id: id(1), email: 'akademik@kampusia.test', role: 'AKADEMIK' as const },
  ADMIN: { id: id(1, 2), email: 'admin@kampusia.test', role: 'ADMIN' as const },
  DOSEN: { id: id(1, 3), email: 'dosen@kampusia.test', role: 'DOSEN' as const },
  MAHASISWA: { id: id(1, 4), email: 'mahasiswa@kampusia.test', role: 'MAHASISWA' as const },
};
export const demoEmail = demoUsers.AKADEMIK.email;

export function developmentData(passwordHash: string) {
  const users = Object.values(demoUsers).map(user => ({
    ...user, passwordHash, isActive: true,
  })) satisfies (typeof schema.users.$inferInsert)[];
  const fakultas = [{ id: id(2), kode: 'DEV-FT', nama: 'Fakultas Teknik', isActive: true }] satisfies (typeof schema.fakultas.$inferInsert)[];
  const programStudi = [{ id: id(3), fakultasId: id(2), kode: 'DEV-IF', nama: 'Informatika', jenjang: 'S1', isActive: true }] satisfies (typeof schema.programStudi.$inferInsert)[];
  const kurikulum = [{ id: id(4), programStudiId: id(3), kode: 'DEV-IF-2026', nama: 'Kurikulum Informatika 2026', tahunBerlaku: 2026, isActive: true }] satisfies (typeof schema.kurikulum.$inferInsert)[];
  const mataKuliah = [
    ['DEV-IF101', 'Algoritma dan Pemrograman'],
    ['DEV-IF201', 'Basis Data'],
    ['DEV-IF301', 'Pemrograman Web'],
    ['DEV-IF202', 'Struktur Data'],
    ['DEV-IF302', 'Sistem Operasi'],
  ].map(([kode, nama], index) => ({ id: id(5, index + 1), kode: kode!, nama: nama!, sks: 3, isActive: true })) satisfies (typeof schema.mataKuliah.$inferInsert)[];
  const kurikulumMatkul = [1, 3, 5, 3, 5].map((semesterRekomendasi, index) => ({
    id: id(6, index + 1), kurikulumId: id(4), mataKuliahId: id(5, index + 1), semesterRekomendasi, isWajib: true,
  })) satisfies (typeof schema.kurikulumMatkul.$inferInsert)[];
  const semester = [{ id: id(7), kode: '20261', nama: 'Ganjil 2026/2027', tahunMulai: 2026, jenis: 'GANJIL', tanggalMulai: '2026-08-24', tanggalSelesai: '2027-01-15', isActive: true }] satisfies (typeof schema.semester.$inferInsert)[];
  const dosen = ['Rina Pratama (Demo)', 'Budi Santoso (Demo)'].map((nama, index) => ({
    id: id(8, index + 1), userId: index === 0 ? demoUsers.DOSEN.id : null,
    programStudiId: id(3), kodeDosen: `DEV-DOS-${index + 1}`, nidn: null, nama, isActive: true,
  })) satisfies (typeof schema.dosen.$inferInsert)[];
  const mahasiswa = ['Andi Saputra', 'Siti Rahma', 'Dewi Lestari', 'Rizky Pratama', 'Nadia Putri'].map((nama, index) => ({
    id: id(9, index + 1), userId: index === 0 ? demoUsers.MAHASISWA.id : null,
    programStudiId: id(3), kurikulumId: id(4), nim: `DEV2026${String(index + 1).padStart(4, '0')}`,
    nama: `${nama} (Demo)`, angkatan: 2026, status: 'AKTIF' as const,
  })) satisfies (typeof schema.mahasiswa.$inferInsert)[];
  const ruangan = [
    { kode: 'DEV-R101', nama: 'Ruang Kuliah 101', kapasitas: 40 },
    { kode: 'DEV-R102', nama: 'Ruang Kuliah 102', kapasitas: 40 },
    { kode: 'DEV-LAB1', nama: 'Laboratorium Informatika', kapasitas: 30 },
  ].map((room, index) => ({ id: id(10, index + 1), ...room, gedung: 'Gedung Teknik (Demo)', isActive: true })) satisfies (typeof schema.ruangan.$inferInsert)[];
  const kelasKuliah = mataKuliah.map((course, index) => ({
    id: id(11, index + 1), semesterId: id(7), mataKuliahId: course.id, programStudiId: id(3), namaKelas: 'A', kapasitas: 30, status: 'DIBUKA' as const,
  })) satisfies (typeof schema.kelasKuliah.$inferInsert)[];
  const kelasDosen = [1, 1, 2, 1, 2].map((lecturer, index) => ({
    id: id(12, index + 1), kelasKuliahId: id(11, index + 1), dosenId: id(8, lecturer), isKoordinator: true as boolean,
  })) satisfies (typeof schema.kelasDosen.$inferInsert)[];
  kelasDosen.push({ id: id(12, 6), kelasKuliahId: id(11, 2), dosenId: id(8, 2), isKoordinator: false });
  const jadwalKuliah = [1, 2, 3, 1, 2].map((room, index) => ({
    id: id(13, index + 1), kelasKuliahId: id(11, index + 1), ruanganId: id(10, room), hari: index + 1, jamMulai: '08:00:00', jamSelesai: '10:30:00',
  })) satisfies (typeof schema.jadwalKuliah.$inferInsert)[];
  const krs = [1, 2, 3].map(student => ({
    id: id(14, student), mahasiswaId: id(9, student), semesterId: id(7), batasSks: 18, status: 'DISETUJUI' as const,
    diajukanAt: new Date('2026-08-20T02:00:00Z'), disetujuiAt: new Date('2026-08-20T03:00:00Z'), disetujuiOleh: id(1),
  })) satisfies (typeof schema.krs.$inferInsert)[];
  const krsDetail = [[2, 3, 4], [2, 3], [2, 5]].flatMap((classes, student) => classes.map(course => ({
    id: id(15, (student + 1) * 10 + course), krsId: id(14, student + 1), kelasKuliahId: id(11, course), status: 'AKTIF' as const,
  }))) satisfies (typeof schema.krsDetail.$inferInsert)[];
  return { users, fakultas, programStudi, kurikulum, mataKuliah, kurikulumMatkul, semester, dosen, mahasiswa, ruangan, kelasKuliah, kelasDosen, jadwalKuliah, krs, krsDetail };
}

export function requireDevelopmentTarget(url: string, environment: string | undefined) {
  if (environment !== 'development') throw new Error('Seed requires NODE_ENV=development.');
  const target = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(target.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
    || target.pathname !== '/kampusia' || (target.port && target.port !== '5432')) {
    throw new Error('Seed is restricted to the local kampusia development database on port 5432.');
  }
}

export function assertFixtureRows(expected: readonly { id: string }[], actual: readonly { id: string }[]) {
  for (const row of expected) {
    const found = actual.find(item => item.id === row.id);
    if (!found) throw new Error(`Missing demo record ${row.id}.`);
    const values = new Map<string, unknown>(Object.entries(found));
    const entries: [string, unknown][] = Object.entries(row);
    for (const [key, value] of entries) {
      // Never reset an existing demo account's password on rerun.
      if (key === 'passwordHash') continue;
      const stored = values.get(key);
      const equal = value instanceof Date && stored instanceof Date
        ? value.getTime() === stored.getTime() : value === stored;
      if (!equal) throw new Error(`Demo record ${row.id} differs at ${key}; refusing to overwrite it.`);
    }
  }
}
