import { requireRole } from '../../middleware/authorization';
import { AuthError, type AuthUser } from '../auth/auth.model';
import { academicWrite, postgresError } from '../../utils/academic-write';
import { MasterDataError, type ListQuery } from '../../utils/master-data';
import { slotsOverlap, validateTime, hasWeekday } from '../jadwal/jadwal.service';
import type { KrsRepository, KrsTransaction } from './krs.repository';
import type { KrsQuery } from './krs.model';
type Plan = NonNullable<Awaited<ReturnType<KrsTransaction['lockPlan']>>>;
type Student = NonNullable<Awaited<ReturnType<KrsTransaction['student']>>>;
const adminRoles = ['ADMIN', 'AKADEMIK'] as const;
export function createKrsService(repository: KrsRepository, initialLimit?: number) {
  const run = <T>(operation: (tx: KrsTransaction) => Promise<T>) => academicWrite(() => repository.transaction(operation));
  async function actor(tx: KrsTransaction, user: AuthUser, admin: boolean) {
    requireRole(user, admin ? adminRoles : ['MAHASISWA']);
    const current = await tx.actor(user.id);
    if (!current?.isActive || current.role !== user.role) throw new AuthError(403, 'Akun tidak memiliki izin KRS.');
  }
  async function student(tx: KrsTransaction, user: AuthUser) {
    const row = await tx.student(user.id);
    if (!row) throw new MasterDataError(404, 'Akun belum terhubung dengan mahasiswa.');
    return row;
  }
  async function eligible(tx: KrsTransaction, row: Student, semesterId: string) {
    if (row.status !== 'AKTIF') throw new MasterDataError(400, 'Hanya mahasiswa AKTIF yang dapat melakukan aktivitas KRS baru.');
    const term = await tx.term(semesterId);
    if (!term) throw new MasterDataError(404, 'Semester tidak ditemukan.');
    if (!term.isActive) throw new MasterDataError(409, 'KRS hanya dapat diproses pada semester aktif.');
    const program = await tx.program(row.programStudiId);
    if (!program?.isActive || !program.facultyActive) throw new MasterDataError(400, 'Program studi dan fakultas harus aktif.');
    // An inactive assigned curriculum remains valid for its existing students.
    return term;
  }
  function state(plan: Plan, expected: Plan['status']) {
    if (plan.status !== expected) throw new MasterDataError(409, `Tindakan membutuhkan KRS ${expected}; status saat ini ${plan.status}.`);
  }
  async function context(tx: KrsTransaction, user: AuthUser, id: string, admin = false) {
    await actor(tx, user, admin);
    const plan = await tx.lockPlan(id);
    if (!plan) throw new MasterDataError(404, 'KRS tidak ditemukan.');
    const owner = admin ? await tx.studentById(plan.mahasiswaId) : await student(tx, user);
    if (!owner || owner.id !== plan.mahasiswaId) throw new MasterDataError(404, 'KRS tidak ditemukan.');
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
  return {
    list(user: AuthUser, query: KrsQuery) { return run(async tx => { await actor(tx, user, true); return tx.list(query); }); },
    get(user: AuthUser, id: string) { return run(async tx => { await context(tx, user, id, true); return (await tx.detail(id))!; }); },
    mine(user: AuthUser, query: ListQuery) { return run(async tx => { await actor(tx, user, false); const owner = await student(tx, user); return { ...await tx.list(query, owner.id), activeSemester: await tx.activeTerm() }; }); },
    bySemester(user: AuthUser, id: string) { return run(async tx => { await actor(tx, user, false); const owner = await student(tx, user); const term = await tx.term(id); if (!term) throw new MasterDataError(404, 'Semester tidak ditemukan.'); const plan = await tx.findPlan(owner.id, id); return { semester: term, krs: plan ? (await tx.detail(plan.id))! : null }; }); },
    async create(user: AuthUser, semesterId: string) {
      const operation = () => run(async tx => {
        await actor(tx, user, false); const owner = await student(tx, user);
        const existing = await tx.findPlan(owner.id, semesterId);
        if (existing) { state(existing, 'DRAFT'); return existing; }
        await eligible(tx, owner, semesterId);
        if (!Number.isInteger(initialLimit) || initialLimit! < 1 || initialLimit! > 32767) throw new MasterDataError(503, 'Kebijakan batas SKS belum dikonfigurasi oleh pengelola.');
        return tx.create(owner.id, semesterId, initialLimit!);
      });
      try { return await operation(); } catch (error) {
        // The unique pair arbitrates simultaneous initial creation. Read the winner in a fresh transaction.
        if (postgresError(error)?.constraint === 'krs_mahasiswa_id_semester_id_unique') return operation();
        throw error;
      }
    },
    available(user: AuthUser, semesterId: string, query: ListQuery) { return run(async tx => { await actor(tx, user, false); const owner = await student(tx, user); await eligible(tx, owner, semesterId); return tx.available(owner, semesterId, query); }); },
    add(user: AuthUser, id: string, classId: string) { return run(async tx => {
      const { plan, owner } = await context(tx, user, id); state(plan, 'DRAFT');
      const details = await tx.details(id); const existing = details.find(row => row.kelasKuliahId === classId);
      if (existing?.status === 'AKTIF') throw new MasterDataError(409, 'Kelas sudah dipilih.');
      const ids = [...details.filter(row => row.status === 'AKTIF').map(row => row.kelasKuliahId), classId];
      await tx.lockClasses(ids);
      if ((await tx.finalizedClassIds([classId])).length) throw new MasterDataError(409, 'Kelas yang nilainya telah difinalisasi tidak menerima penambahan atau pengaktifan ulang KRS.');
      await validate(tx, plan, owner, ids);
      const result = existing ? await tx.selection(existing.id, 'AKTIF') : await tx.add(id, classId);
      await tx.update(id, {}); return result;
    }); },
    remove(user: AuthUser, id: string, detailId: string) { return run(async tx => {
      const { plan, owner } = await context(tx, user, id); state(plan, 'DRAFT'); await eligible(tx, owner, plan.semesterId);
      const detail = (await tx.details(id)).find(row => row.id === detailId);
      if (!detail) throw new MasterDataError(404, 'Pilihan tidak ditemukan pada KRS ini.');
      await tx.lockClasses([detail.kelasKuliahId]); const result = await tx.selection(detailId, 'DIBATALKAN'); await tx.update(id, {}); return result;
    }); },
    submit(user: AuthUser, id: string) { return run(async tx => {
      const { plan, owner } = await context(tx, user, id); state(plan, 'DRAFT'); const ids = await activeIds(tx, id);
      if (!ids.length) throw new MasterDataError(400, 'Pilih setidaknya satu kelas sebelum mengajukan KRS.');
      await tx.lockClasses(ids); await validate(tx, plan, owner, ids);
      return tx.update(id, { status: 'DIAJUKAN', diajukanAt: new Date() });
    }); },
    reopen(user: AuthUser, id: string, admin = false) { return run(async tx => {
      const { plan, owner } = await context(tx, user, id, admin); state(plan, admin ? 'DISETUJUI' : 'DITOLAK');
      if (admin) { const term = await tx.term(plan.semesterId); if (!term?.isActive) throw new MasterDataError(409, 'Pembukaan kembali hanya pada semester aktif.'); }
      else await eligible(tx, owner, plan.semesterId);
      await tx.lockClasses(await activeIds(tx, id));
      return tx.update(id, { status: 'DRAFT', diajukanAt: null, disetujuiAt: null, disetujuiOleh: null });
    }); },
    approve(user: AuthUser, id: string) { return run(async tx => {
      const { plan, owner } = await context(tx, user, id, true); state(plan, 'DIAJUKAN'); const ids = await activeIds(tx, id);
      if (!ids.length) throw new MasterDataError(400, 'KRS membutuhkan setidaknya satu pilihan aktif.');
      await tx.lockClasses(ids); await validate(tx, plan, owner, ids, true);
      return tx.update(id, { status: 'DISETUJUI', disetujuiAt: new Date(), disetujuiOleh: user.id });
    }); },
    reject(user: AuthUser, id: string) { return run(async tx => { const { plan } = await context(tx, user, id, true); state(plan, 'DIAJUKAN'); return tx.update(id, { status: 'DITOLAK' }); }); },
    cancel(user: AuthUser, id: string) { return run(async tx => {
      const { plan } = await context(tx, user, id, true);
      if (plan.status === 'DIBATALKAN') throw new MasterDataError(409, 'KRS sudah dibatalkan dan bersifat final.');
      await tx.lockClasses(await activeIds(tx, id)); await tx.cancelDetails(id);
      return tx.update(id, { status: 'DIBATALKAN' });
    }); },
  };
}
export type KrsService = ReturnType<typeof createKrsService>;
