import { relations } from 'drizzle-orm';
import { users } from './users';
import { fakultas } from './fakultas';
import { programStudi } from './program-studi';
import { mahasiswa } from './mahasiswa';
import { dosen } from './dosen';
import { semester } from './semester';
import { mataKuliah } from './mata-kuliah';
import { kurikulum } from './kurikulum';
import { kurikulumMatkul } from './kurikulum-matkul';
import { kelasKuliah } from './kelas-kuliah';
import { kelasDosen } from './kelas-dosen';
import { ruangan } from './ruangan';
import { jadwalKuliah } from './jadwal-kuliah';
import { pertemuan } from './pertemuan';
import { absensi } from './absensi';
import { krs } from './krs';
import { krsDetail } from './krs-detail';
import { komponenNilai } from './komponen-nilai';
import { nilaiMahasiswa } from './nilai-mahasiswa';
import { hasilStudi } from './hasil-studi';

export const usersRelations = relations(users, ({ one, many }) => ({
  mahasiswa: one(mahasiswa),
  dosen: one(dosen),
  krsDisetujui: many(krs, { relationName: 'krs_disetujui_oleh' }),
  krsDitolak: many(krs, { relationName: 'krs_ditolak_oleh' }),
  krsDibukaKembali: many(krs, { relationName: 'krs_dibuka_kembali_oleh' }),
  krsDibatalkan: many(krs, { relationName: 'krs_dibatalkan_oleh' }),
  absensiDicatat: many(absensi, { relationName: 'absensi_dicatat_oleh' }),
  absensiDiubah: many(absensi, { relationName: 'absensi_diubah_oleh' }),
  nilaiMahasiswaDicatat: many(nilaiMahasiswa, { relationName: 'nilai_mahasiswa_dicatat_oleh' }),
  nilaiMahasiswaDiubah: many(nilaiMahasiswa, { relationName: 'nilai_mahasiswa_diubah_oleh' }),
  hasilStudiDifinalisasi: many(hasilStudi, { relationName: 'hasil_studi_difinalisasi_oleh' }),
  hasilStudiDikoreksi: many(hasilStudi, { relationName: 'hasil_studi_dikoreksi_oleh' }),
}));

export const fakultasRelations = relations(fakultas, ({ many }) => ({
  programStudi: many(programStudi),
}));

export const programStudiRelations = relations(programStudi, ({ one, many }) => ({
  fakultas: one(fakultas, {
    fields: [programStudi.fakultasId],
    references: [fakultas.id],
  }),
  mahasiswa: many(mahasiswa),
  dosen: many(dosen),
  kurikulum: many(kurikulum),
  kelasKuliah: many(kelasKuliah),
}));

export const mahasiswaRelations = relations(mahasiswa, ({ one, many }) => ({
  users: one(users, {
    fields: [mahasiswa.userId],
    references: [users.id],
  }),
  programStudi: one(programStudi, {
    fields: [mahasiswa.programStudiId],
    references: [programStudi.id],
  }),
  kurikulum: one(kurikulum, {
    fields: [mahasiswa.kurikulumId, mahasiswa.programStudiId],
    references: [kurikulum.id, kurikulum.programStudiId],
  }),
  dosenPa: one(dosen, {
    fields: [mahasiswa.dosenPaId],
    references: [dosen.id],
    relationName: 'mahasiswa_dosen_pa',
  }),
  krs: many(krs),
  absensi: many(absensi),
  nilaiMahasiswa: many(nilaiMahasiswa),
  hasilStudi: many(hasilStudi),
}));

export const dosenRelations = relations(dosen, ({ one, many }) => ({
  users: one(users, {
    fields: [dosen.userId],
    references: [users.id],
  }),
  programStudi: one(programStudi, {
    fields: [dosen.programStudiId],
    references: [programStudi.id],
  }),
  kelasDosen: many(kelasDosen),
  mahasiswaBimbingan: many(mahasiswa, { relationName: 'mahasiswa_dosen_pa' }),
}));

export const semesterRelations = relations(semester, ({ many }) => ({
  kelasKuliah: many(kelasKuliah),
  krs: many(krs),
}));

export const mataKuliahRelations = relations(mataKuliah, ({ many }) => ({
  kurikulumMatkul: many(kurikulumMatkul),
  kelasKuliah: many(kelasKuliah),
}));

export const kurikulumRelations = relations(kurikulum, ({ one, many }) => ({
  programStudi: one(programStudi, {
    fields: [kurikulum.programStudiId],
    references: [programStudi.id],
  }),
  kurikulumMatkul: many(kurikulumMatkul),
  mahasiswa: many(mahasiswa),
}));

export const kurikulumMatkulRelations = relations(kurikulumMatkul, ({ one }) => ({
  kurikulum: one(kurikulum, {
    fields: [kurikulumMatkul.kurikulumId],
    references: [kurikulum.id],
  }),
  mataKuliah: one(mataKuliah, {
    fields: [kurikulumMatkul.mataKuliahId],
    references: [mataKuliah.id],
  }),
}));

export const kelasKuliahRelations = relations(kelasKuliah, ({ one, many }) => ({
  semester: one(semester, {
    fields: [kelasKuliah.semesterId],
    references: [semester.id],
  }),
  mataKuliah: one(mataKuliah, {
    fields: [kelasKuliah.mataKuliahId],
    references: [mataKuliah.id],
  }),
  programStudi: one(programStudi, {
    fields: [kelasKuliah.programStudiId],
    references: [programStudi.id],
  }),
  kelasDosen: many(kelasDosen),
  jadwalKuliah: one(jadwalKuliah),
  krsDetail: many(krsDetail),
  pertemuan: many(pertemuan),
  komponenNilai: many(komponenNilai),
  hasilStudi: many(hasilStudi),
}));

export const kelasDosenRelations = relations(kelasDosen, ({ one }) => ({
  kelasKuliah: one(kelasKuliah, {
    fields: [kelasDosen.kelasKuliahId],
    references: [kelasKuliah.id],
  }),
  dosen: one(dosen, {
    fields: [kelasDosen.dosenId],
    references: [dosen.id],
  }),
}));

export const ruanganRelations = relations(ruangan, ({ many }) => ({
  jadwalKuliah: many(jadwalKuliah),
}));

export const jadwalKuliahRelations = relations(jadwalKuliah, ({ one }) => ({
  kelasKuliah: one(kelasKuliah, {
    fields: [jadwalKuliah.kelasKuliahId],
    references: [kelasKuliah.id],
  }),
  ruangan: one(ruangan, {
    fields: [jadwalKuliah.ruanganId],
    references: [ruangan.id],
  }),
}));

export const pertemuanRelations = relations(pertemuan, ({ one, many }) => ({
  kelasKuliah: one(kelasKuliah, {
    fields: [pertemuan.kelasKuliahId],
    references: [kelasKuliah.id],
  }),
  absensi: many(absensi),
}));

export const absensiRelations = relations(absensi, ({ one }) => ({
  pertemuan: one(pertemuan, {
    fields: [absensi.pertemuanId],
    references: [pertemuan.id],
  }),
  mahasiswa: one(mahasiswa, {
    fields: [absensi.mahasiswaId],
    references: [mahasiswa.id],
  }),
  dicatatOleh: one(users, {
    fields: [absensi.dicatatOleh],
    references: [users.id],
    relationName: 'absensi_dicatat_oleh',
  }),
  diubahOleh: one(users, {
    fields: [absensi.diubahOleh],
    references: [users.id],
    relationName: 'absensi_diubah_oleh',
  }),
}));

export const krsRelations = relations(krs, ({ one, many }) => ({
  mahasiswa: one(mahasiswa, {
    fields: [krs.mahasiswaId],
    references: [mahasiswa.id],
  }),
  semester: one(semester, {
    fields: [krs.semesterId],
    references: [semester.id],
  }),
  disetujuiOleh: one(users, {
    fields: [krs.disetujuiOleh],
    references: [users.id],
    relationName: 'krs_disetujui_oleh',
  }),
  ditolakOleh: one(users, {
    fields: [krs.ditolakOleh],
    references: [users.id],
    relationName: 'krs_ditolak_oleh',
  }),
  dibukaKembaliOleh: one(users, {
    fields: [krs.dibukaKembaliOleh],
    references: [users.id],
    relationName: 'krs_dibuka_kembali_oleh',
  }),
  dibatalkanOleh: one(users, {
    fields: [krs.dibatalkanOleh],
    references: [users.id],
    relationName: 'krs_dibatalkan_oleh',
  }),
  krsDetail: many(krsDetail),
}));

export const krsDetailRelations = relations(krsDetail, ({ one }) => ({
  krs: one(krs, {
    fields: [krsDetail.krsId],
    references: [krs.id],
  }),
  kelasKuliah: one(kelasKuliah, {
    fields: [krsDetail.kelasKuliahId],
    references: [kelasKuliah.id],
  }),
}));

export const komponenNilaiRelations = relations(komponenNilai, ({ one, many }) => ({
  kelasKuliah: one(kelasKuliah, {
    fields: [komponenNilai.kelasKuliahId],
    references: [kelasKuliah.id],
  }),
  nilaiMahasiswa: many(nilaiMahasiswa),
}));

export const nilaiMahasiswaRelations = relations(nilaiMahasiswa, ({ one }) => ({
  komponenNilai: one(komponenNilai, {
    fields: [nilaiMahasiswa.komponenNilaiId],
    references: [komponenNilai.id],
  }),
  mahasiswa: one(mahasiswa, {
    fields: [nilaiMahasiswa.mahasiswaId],
    references: [mahasiswa.id],
  }),
  dicatatOleh: one(users, {
    fields: [nilaiMahasiswa.dicatatOleh],
    references: [users.id],
    relationName: 'nilai_mahasiswa_dicatat_oleh',
  }),
  diubahOleh: one(users, {
    fields: [nilaiMahasiswa.diubahOleh],
    references: [users.id],
    relationName: 'nilai_mahasiswa_diubah_oleh',
  }),
}));

export const hasilStudiRelations = relations(hasilStudi, ({ one }) => ({
  kelasKuliah: one(kelasKuliah, {
    fields: [hasilStudi.kelasKuliahId],
    references: [kelasKuliah.id],
  }),
  mahasiswa: one(mahasiswa, {
    fields: [hasilStudi.mahasiswaId],
    references: [mahasiswa.id],
  }),
  difinalisasiOleh: one(users, {
    fields: [hasilStudi.difinalisasiOleh],
    references: [users.id],
    relationName: 'hasil_studi_difinalisasi_oleh',
  }),
  dikoreksiOleh: one(users, {
    fields: [hasilStudi.dikoreksiOleh],
    references: [users.id],
    relationName: 'hasil_studi_dikoreksi_oleh',
  }),
}));
