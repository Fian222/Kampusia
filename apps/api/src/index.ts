import { createKelasDosenRepository } from './modules/kelas-dosen/kelas-dosen.repository';
import { createKelasDosenService } from './modules/kelas-dosen/kelas-dosen.service';
import { createKelasKuliahRepository } from './modules/kelas-kuliah/kelas-kuliah.repository';
import { createKelasKuliahService } from './modules/kelas-kuliah/kelas-kuliah.service';
import { createSemesterRepository } from './modules/semester/semester.repository';
import { createSemesterService } from './modules/semester/semester.service';
import { createKurikulumMatkulRepository } from './modules/kurikulum-matkul/kurikulum-matkul.repository';
import { createKurikulumMatkulService } from './modules/kurikulum-matkul/kurikulum-matkul.service';
import { createKurikulumRepository } from './modules/kurikulum/kurikulum.repository';
import { createKurikulumService } from './modules/kurikulum/kurikulum.service';
import { createMataKuliahRepository } from './modules/mata-kuliah/mata-kuliah.repository';
import { createMataKuliahService } from './modules/mata-kuliah/mata-kuliah.service';
import { createDatabase } from '@kampusia/db';
import { createApp } from './app';
import { createAuthRepository } from './modules/auth/auth.repository';
import { createAuthService } from './modules/auth/auth.service';
import { createFakultasRepository } from './modules/fakultas/fakultas.repository';
import { createFakultasService } from './modules/fakultas/fakultas.service';
import { createProgramStudiRepository } from './modules/program-studi/program-studi.repository';
import { createProgramStudiService } from './modules/program-studi/program-studi.service';
import { createMahasiswaRepository } from './modules/mahasiswa/mahasiswa.repository';
import { createMahasiswaService } from './modules/mahasiswa/mahasiswa.service';
import { createDosenRepository } from './modules/dosen/dosen.repository';
import { createDosenService } from './modules/dosen/dosen.service';

const port = Number(Bun.env.API_PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('API_PORT must be an integer between 1 and 65535.');
}

const production = Bun.env.NODE_ENV === 'production';
const webOrigin = new URL(Bun.env.WEB_URL ?? 'http://localhost:5173').origin;
if (production && !webOrigin.startsWith('https://')) throw new Error('Production WEB_URL must use HTTPS.');
const { db, client } = createDatabase(Bun.env.DATABASE_URL ?? '');
const app = createApp(createAuthService(createAuthRepository(db)), { webOrigin, production }, {
  semester: createSemesterService(createSemesterRepository(db)),
  kelasKuliah: createKelasKuliahService(createKelasKuliahRepository(db)),
  kelasDosen: createKelasDosenService(createKelasDosenRepository(db)),
  mataKuliah: createMataKuliahService(createMataKuliahRepository(db)),
  kurikulum: createKurikulumService(createKurikulumRepository(db)),
  kurikulumMatkul: createKurikulumMatkulService(createKurikulumMatkulRepository(db)),
  fakultas: createFakultasService(createFakultasRepository(db)),
  programStudi: createProgramStudiService(createProgramStudiRepository(db)),
  mahasiswa: createMahasiswaService(createMahasiswaRepository(db)),
  dosen: createDosenService(createDosenRepository(db)),
});
app.listen(port);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => { await app.stop(); await client.end(); process.exit(0); });
}
console.log(`Kampusia API listening on http://localhost:${port}`);
