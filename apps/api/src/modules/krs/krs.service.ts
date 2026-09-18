import { requireRole } from '../../middleware/authorization';
import { AuthError, type AuthUser } from '../auth/auth.model';
import { academicWrite, postgresError } from '../../utils/academic-write';
import { MasterDataError, type ListQuery } from '../../utils/master-data';
import { slotsOverlap, validateTime, hasWeekday } from '../jadwal/jadwal.service';
import { calculateAcademicIndex } from '../hasil-studi/academic-result';
import { getMaximumCreditsFromIps } from './credit-limit-policy';
import type { KrsRepository, KrsTransaction } from './krs.repository';
import type { KrsQuery } from './krs.model';

type Plan = NonNullable<Awaited<ReturnType<KrsTransaction['lockPlan']>>>;
type Student = NonNullable<Awaited<ReturnType<KrsTransaction['student']>>>;
const adminRoles = ['ADMIN', 'AKADEMIK'] as const;
type MaximumCreditsPolicy = (ips: string) => number;
type LimitResolution = {
  batasSks: number;
  batasSksSource: 'PREVIOUS_IPS' | 'INITIAL_FALLBACK';
  previousSemester: Awaited<ReturnType<KrsTransaction['previousTerm']>> | null;
  previousIps: string | null;
  fallbackReason: 'NO_PREVIOUS_SEMESTER' | 'NO_FINALIZED_RESULTS' | 'UNFINISHED_RESULTS' | null;
};

export function createKrsService(
  repository: KrsRepository,
  initialLimit?: number,
  maximumCreditsPolicy: MaximumCreditsPolicy = getMaximumCreditsFromIps,
  clock: () => Date = () => new Date(),
) {
  const run = <T>(operation: (tx: KrsTransaction) => Promise<T>) => academicWrite(() => repository.transaction(operation));
  async function actor(tx: KrsTransaction, user: AuthUser, roles: readonly AuthUser['role'][]) {
    requireRole(user, roles);
    const current = await tx.actor(user.id);
    if (!current?.isActive || current.role !== user.role) throw new AuthError(403, 'Akun tidak memiliki izin KRS.');
  }
  async function student(tx: KrsTransaction, user: AuthUser) {
    const row = await tx.student(user.id);
    if (!row) throw new MasterDataError(404, 'Akun belum terhubung dengan mahasiswa.');
    return row;
  }
  function ensureOpen(term: NonNullable<Awaited<ReturnType<KrsTransaction['term']>>>, at = clock()) {
    if (!term.isActive) throw new MasterDataError(409, 'KRS hanya dapat diproses pada semester aktif.');
    if (!term.krsMulaiAt || !term.krsSelesaiAt) throw new MasterDataError(409, 'Periode KRS semester aktif belum dijadwalkan.');
    if (at < term.krsMulaiAt) throw new MasterDataError(409, 'Periode KRS belum dibuka.');
    if (at >= term.krsSelesaiAt) throw new MasterDataError(409, 'Periode KRS sudah ditutup.');
  }
  async function eligible(tx: KrsTransaction, row: Student, semesterId: string, requireOpen = true) {
    if (row.status !== 'AKTIF') throw new MasterDataError(400, 'Hanya mahasiswa AKTIF yang dapat melakukan aktivitas KRS baru.');
    const term = await tx.term(semesterId);
    if (!term) throw new MasterDataError(404, 'Semester tidak ditemukan.');
    if (requireOpen) ensureOpen(term);
    const program = await tx.program(row.programStudiId);
    if (!program?.isActive || !program.facultyActive) throw new MasterDataError(400, 'Program studi dan fakultas harus aktif.');
    return term;
  }
  async function validAdviser(tx: KrsTransaction, owner: Student) {
    if (!owner.dosenPaId) throw new MasterDataError(409, 'Dosen PA belum ditetapkan. Hubungi pengelola akademik.');
    const adviser = await tx.adviser(owner.dosenPaId);
    if (!adviser) throw new MasterDataError(409, 'Data Dosen PA tidak ditemukan. Hubungi pengelola akademik.');
    if (!adviser.isActive) throw new MasterDataError(409, 'Dosen PA tidak aktif. Hubungi pengelola akademik.');
    if (!adviser.userId || !adviser.account) throw new MasterDataError(409, 'Dosen PA belum terhubung ke akun DOSEN.');
    if (!adviser.account.isActive) throw new MasterDataError(409, 'Akun Dosen PA tidak aktif.');
    if (adviser.account.role !== 'DOSEN') throw new MasterDataError(409, 'Akun Dosen PA tidak memiliki peran DOSEN.');
  }
  function fallbackLimit(reason: NonNullable<LimitResolution['fallbackReason']>, previousSemester: LimitResolution['previousSemester'] = null): LimitResolution {
    if (!Number.isInteger(initialLimit) || initialLimit! < 1 || initialLimit! > 32767) throw new MasterDataError(503, 'Kebijakan batas SKS awal belum dikonfigurasi oleh pengelola.');
    return { batasSks: initialLimit!, batasSksSource: 'INITIAL_FALLBACK', previousSemester, previousIps: null, fallbackReason: reason };
  }
  async function resolveLimit(tx: KrsTransaction, owner: Student, targetSemester: NonNullable<Awaited<ReturnType<KrsTransaction['term']>>>): Promise<LimitResolution> {
    const previousSemester = await tx.previousTerm(targetSemester);
    if (!previousSemester) return fallbackLimit('NO_PREVIOUS_SEMESTER');
    const [results, unfinishedResultCount] = await Promise.all([tx.academicResults(owner.id, previousSemester.id), tx.unfinishedResultCount(owner.id, previousSemester.id)]);
    if (!results.length) return fallbackLimit('NO_FINALIZED_RESULTS', previousSemester);
    if (unfinishedResultCount > 0) return fallbackLimit('UNFINISHED_RESULTS', previousSemester);
    const calculation = calculateAcademicIndex(results);
    if (calculation.index === null) return fallbackLimit('NO_FINALIZED_RESULTS', previousSemester);
    const batasSks = maximumCreditsPolicy(calculation.index);
    if (!Number.isInteger(batasSks) || batasSks < 1 || batasSks > 32767) throw new MasterDataError(503, 'Kebijakan batas SKS menghasilkan nilai yang tidak valid.');
    return { batasSks, batasSksSource: 'PREVIOUS_IPS', previousSemester, previousIps: calculation.index, fallbackReason: null };
  }
  function state(plan: Plan, expected: Plan['status']) {
    if (plan.status !== expected) throw new MasterDataError(409, `Tindakan membutuhkan KRS ${expected}; status saat ini ${plan.status}.`);
  }
  function reason(value: string, label: string) {
    const normalized = value.trim();
    if (!normalized) throw new MasterDataError(400, `${label} wajib diisi.`);
    if (normalized.length > 2000) throw new MasterDataError(400, `${label} maksimal 2000 karakter.`);
    return normalized;
  }
  async function studentContext(tx: KrsTransaction, user: AuthUser, id: string) {
    await actor(tx, user, ['MAHASISWA']); const plan = await tx.lockPlan(id);
    if (!plan) throw new MasterDataError(404, 'KRS tidak ditemukan.');
    const owner = await student(tx, user);
    if (owner.id !== plan.mahasiswaId) throw new MasterDataError(404, 'KRS tidak ditemukan.');
    return { plan, owner };
  }
  async function adminContext(tx: KrsTransaction, user: AuthUser, id: string) {
    await actor(tx, user, adminRoles); const plan = await tx.lockPlan(id);
    if (!plan) throw new MasterDataError(404, 'KRS tidak ditemukan.');
    const owner = await tx.studentById(plan.mahasiswaId);
    if (!owner) throw new MasterDataError(404, 'KRS tidak ditemukan.');
    return { plan, owner };
  }
  async function reviewContext(tx: KrsTransaction, user: AuthUser, id: string) {
    await actor(tx, user, [...adminRoles, 'DOSEN']);
    let plan: Plan | undefined;
    if (user.role === 'ADMIN' || user.role === 'AKADEMIK') plan = await tx.lockPlan(id);
    else {
      const lecturer = await tx.lecturerByUser(user.id);
      if (!lecturer?.isActive) throw new MasterDataError(404, 'KRS tidak ditemukan.');
      plan = await tx.lockAdvisedPlan(id, lecturer.id);
    }
    if (!plan) throw new MasterDataError(404, 'KRS tidak ditemukan.');
    const owner = await tx.studentById(plan.mahasiswaId);
    if (!owner) throw new MasterDataError(404, 'KRS tidak ditemukan.');
    return { plan, owner };
  }
  async function validate(tx: KrsTransaction, plan: Plan, owner: Student, ids: string[], capacity = false) {
    const term = await eligible(tx, owner, plan.semesterId);
    const classes = await tx.classes(ids);
    if (classes.length !== ids.length) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
    const members = new Set((await tx.memberships(owner.kurikulumId)).map(row => row.id));
    const courses = new Set<string>(); let total = 0;
    for (const kelas of classes) {
      const label = `${kelas.mataKuliah.kode} / ${kelas.namaKelas}`;
      if (kelas.semesterId !== plan.semesterId) throw new MasterDataError(400, `Semester kelas ${label} tidak sesuai KRS.`);
      if (kelas.programStudiId !== owner.programStudiId) throw new MasterDataError(400, `Program studi kelas ${label} tidak sesuai mahasiswa.`);
      if (kelas.status !== 'DIBUKA' || !kelas.mataKuliah.isActive) throw new MasterDataError(400, `Kelas ${label} harus DIBUKA dengan mata kuliah aktif.`);
      if (!members.has(kelas.mataKuliahId)) throw new MasterDataError(400, `Mata kuliah ${label} tidak termasuk kurikulum mahasiswa.`);
      if (courses.has(kelas.mataKuliahId)) throw new MasterDataError(409, `Mata kuliah ${kelas.mataKuliah.kode} sudah dipilih melalui kelas lain.`);
      courses.add(kelas.mataKuliahId); total += kelas.mataKuliah.sks;
      if (!kelas.dosen.some(item => item.dosen.isActive)) throw new MasterDataError(400, `Kelas ${label} membutuhkan dosen aktif.`);
      if (!kelas.jadwal.length) throw new MasterDataError(400, `Kelas ${label} belum memiliki jadwal.`);
      for (const slot of kelas.jadwal) {
        validateTime(slot);
        if (!hasWeekday(term.tanggalMulai, term.tanggalSelesai, slot.hari) || !slot.ruangan.isActive || slot.ruangan.kapasitas < kelas.kapasitas) throw new MasterDataError(400, `Jadwal atau ruangan kelas ${label} tidak valid.`);
      }
      if (capacity && kelas.jumlahMahasiswa >= kelas.kapasitas) throw new MasterDataError(409, `Kelas ${label} penuh; kapasitas ${kelas.kapasitas}.`);
    }
    if (total > plan.batasSks) throw new MasterDataError(400, `Total ${total} SKS melebihi batas ${plan.batasSks} SKS.`);
    for (let i = 0; i < classes.length; i++) for (let j = i + 1; j < classes.length; j++) {
      const a = classes[i]!, b = classes[j]!;
      if (a.jadwal.some(slot => b.jadwal.some(other => slotsOverlap(slot, other, term)))) throw new MasterDataError(409, `Jadwal bentrok: ${a.mataKuliah.kode} / ${a.namaKelas} dengan ${b.mataKuliah.kode} / ${b.namaKelas}.`);
    }
  }
  async function activeIds(tx: KrsTransaction, id: string) { return (await tx.details(id)).filter(row => row.status === 'AKTIF').map(row => row.kelasKuliahId); }
  async function detailWithAcademicContext(tx: KrsTransaction, id: string) {
    const detail = await tx.detail(id);
    if (!detail) throw new MasterDataError(404, 'KRS tidak ditemukan.');
    const previous = await tx.previousTerm(detail.semester); let previousIps: string | null = null;
    if (previous) {
      const [results, unfinished] = await Promise.all([tx.academicResults(detail.mahasiswaId, previous.id), tx.unfinishedResultCount(detail.mahasiswaId, previous.id)]);
      if (results.length && unfinished === 0) previousIps = calculateAcademicIndex(results).index;
    }
    return { ...detail, previousSemester: previous, previousIps };
  }

  return {
    list(user: AuthUser, query: KrsQuery) { return run(async tx => { await actor(tx, user, adminRoles); return tx.list(query); }); },
    get(user: AuthUser, id: string) { return run(async tx => { await adminContext(tx, user, id); return detailWithAcademicContext(tx, id); }); },
    adviserList(user: AuthUser, query: KrsQuery) { return run(async tx => {
      await actor(tx, user, ['DOSEN']); const lecturer = await tx.lecturerByUser(user.id);
      if (!lecturer?.isActive) throw new AuthError(403, 'Akun tidak terhubung dengan dosen aktif.');
      return tx.list(query.status ? query : { ...query, status: 'DIAJUKAN' }, undefined, lecturer.id);
    }); },
    adviserGet(user: AuthUser, id: string) { return run(async tx => { await reviewContext(tx, user, id); return detailWithAcademicContext(tx, id); }); },
    mine(user: AuthUser, query: ListQuery) { return run(async tx => { await actor(tx, user, ['MAHASISWA']); const owner = await student(tx, user); return { ...await tx.list(query, owner.id), activeSemester: await tx.activeTerm() }; }); },
    bySemester(user: AuthUser, id: string) { return run(async tx => { await actor(tx, user, ['MAHASISWA']); const owner = await student(tx, user); const term = await tx.term(id); if (!term) throw new MasterDataError(404, 'Semester tidak ditemukan.'); const plan = await tx.findPlan(owner.id, id); return { semester: term, krs: plan ? await detailWithAcademicContext(tx, plan.id) : null }; }); },
    async create(user: AuthUser, semesterId: string) {
      const operation = () => run(async tx => {
        await actor(tx, user, ['MAHASISWA']); const owner = await student(tx, user); const targetSemester = await eligible(tx, owner, semesterId);
        const existing = await tx.findPlan(owner.id, semesterId);
        if (existing) { state(existing, 'DRAFT'); return { ...existing, batasSksSource: 'EXISTING_SNAPSHOT' as const, previousSemester: null, previousIps: null, fallbackReason: null }; }
        const resolution = await resolveLimit(tx, owner, targetSemester);
        return Object.assign(await tx.create(owner.id, semesterId, resolution.batasSks), resolution);
      });
      try { return await operation(); } catch (error) { if (postgresError(error)?.constraint === 'krs_mahasiswa_id_semester_id_unique') return operation(); throw error; }
    },
    available(user: AuthUser, semesterId: string, query: ListQuery) { return run(async tx => { await actor(tx, user, ['MAHASISWA']); const owner = await student(tx, user); await eligible(tx, owner, semesterId, false); return tx.available(owner, semesterId, query); }); },
    add(user: AuthUser, id: string, classId: string) { return run(async tx => {
      const { plan, owner } = await studentContext(tx, user, id); state(plan, 'DRAFT');
      const details = await tx.details(id); const existing = details.find(row => row.kelasKuliahId === classId);
      if (existing?.status === 'AKTIF') throw new MasterDataError(409, 'Kelas sudah dipilih.');
      const ids = [...details.filter(row => row.status === 'AKTIF').map(row => row.kelasKuliahId), classId]; await tx.lockClasses(ids);
      if ((await tx.finalizedClassIds([classId])).length) throw new MasterDataError(409, 'Kelas yang nilainya telah difinalisasi tidak menerima penambahan atau pengaktifan ulang KRS.');
      await validate(tx, plan, owner, ids); const result = existing ? await tx.selection(existing.id, 'AKTIF') : await tx.add(id, classId); await tx.update(id, {}); return result;
    }); },
    remove(user: AuthUser, id: string, detailId: string) { return run(async tx => {
      const { plan, owner } = await studentContext(tx, user, id); state(plan, 'DRAFT'); await eligible(tx, owner, plan.semesterId);
      const detail = (await tx.details(id)).find(row => row.id === detailId); if (!detail) throw new MasterDataError(404, 'Pilihan tidak ditemukan pada KRS ini.');
      await tx.lockClasses([detail.kelasKuliahId]); const result = await tx.selection(detailId, 'DIBATALKAN'); await tx.update(id, {}); return result;
    }); },
    clear(user: AuthUser, id: string) { return run(async tx => {
      const { plan, owner } = await studentContext(tx, user, id); state(plan, 'DRAFT'); await eligible(tx, owner, plan.semesterId);
      const ids = await activeIds(tx, id); await tx.lockClasses(ids); const at = clock(); await tx.cancelDetails(id, at); return tx.update(id, { updatedAt: at });
    }); },
    submit(user: AuthUser, id: string) { return run(async tx => {
      const { plan, owner } = await studentContext(tx, user, id); state(plan, 'DRAFT'); const ids = await activeIds(tx, id);
      if (!ids.length) throw new MasterDataError(400, 'Pilih setidaknya satu kelas sebelum mengajukan KRS.');
      await tx.lockClasses(ids); await validAdviser(tx, owner); await validate(tx, plan, owner, ids);
      const at = clock(); return tx.update(id, { status: 'DIAJUKAN', diajukanAt: at, updatedAt: at });
    }); },
    reopenRejected(user: AuthUser, id: string) { return run(async tx => {
      const { plan, owner } = await studentContext(tx, user, id); state(plan, 'DITOLAK'); await eligible(tx, owner, plan.semesterId);
      await tx.lockClasses(await activeIds(tx, id)); const at = clock(); return tx.update(id, { status: 'DRAFT', diajukanAt: null, updatedAt: at });
    }); },
    approve(user: AuthUser, id: string) { return run(async tx => {
      const { plan, owner } = await reviewContext(tx, user, id); state(plan, 'DIAJUKAN'); const ids = await activeIds(tx, id);
      if (!ids.length) throw new MasterDataError(400, 'KRS membutuhkan setidaknya satu pilihan aktif.');
      await tx.lockClasses(ids); await validate(tx, plan, owner, ids, true); const at = clock();
      return tx.update(id, { status: 'DISETUJUI', disetujuiAt: at, disetujuiOleh: user.id, updatedAt: at });
    }); },
    reject(user: AuthUser, id: string, value = 'Ditolak oleh pengelola akademik.') { return run(async tx => {
      const { plan, owner } = await reviewContext(tx, user, id); state(plan, 'DIAJUKAN'); await eligible(tx, owner, plan.semesterId); const at = clock();
      return tx.update(id, { status: 'DITOLAK', ditolakAt: at, ditolakOleh: user.id, alasanPenolakan: reason(value, 'Alasan penolakan'), updatedAt: at });
    }); },
    reopenApproved(user: AuthUser, id: string) { return run(async tx => {
      const { plan, owner } = await reviewContext(tx, user, id); state(plan, 'DISETUJUI'); await eligible(tx, owner, plan.semesterId);
      await tx.lockClasses(await activeIds(tx, id)); const at = clock();
      return tx.update(id, { status: 'DRAFT', diajukanAt: null, dibukaKembaliAt: at, dibukaKembaliOleh: user.id, updatedAt: at });
    }); },
    cancel(user: AuthUser, id: string, value = 'Dibatalkan oleh pengelola akademik.') { return run(async tx => {
      const { plan } = await adminContext(tx, user, id); if (plan.status === 'DIBATALKAN') throw new MasterDataError(409, 'KRS sudah dibatalkan dan bersifat final.');
      await tx.lockClasses(await activeIds(tx, id)); const at = clock(); await tx.cancelDetails(id, at);
      return tx.update(id, { status: 'DIBATALKAN', dibatalkanAt: at, dibatalkanOleh: user.id, alasanPembatalan: reason(value, 'Alasan pembatalan administratif'), updatedAt: at });
    }); },
    // Compatibility for internal academic-history integrations while callers migrate
    // to the explicit rejected/approved transition names.
    reopen(user: AuthUser, id: string, administrative = false) { return administrative ? run(async tx => {
      const { plan, owner } = await reviewContext(tx, user, id); state(plan, 'DISETUJUI'); await eligible(tx, owner, plan.semesterId);
      await tx.lockClasses(await activeIds(tx, id)); const at = clock();
      return tx.update(id, { status: 'DRAFT', diajukanAt: null, dibukaKembaliAt: at, dibukaKembaliOleh: user.id, updatedAt: at });
    }) : run(async tx => {
      const { plan, owner } = await studentContext(tx, user, id); state(plan, 'DITOLAK'); await eligible(tx, owner, plan.semesterId);
      await tx.lockClasses(await activeIds(tx, id)); const at = clock(); return tx.update(id, { status: 'DRAFT', diajukanAt: null, updatedAt: at });
    }); },
  };
}
export type KrsService = ReturnType<typeof createKrsService>;
