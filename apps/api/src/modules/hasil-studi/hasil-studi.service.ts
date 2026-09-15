import { requireRole } from '../../middleware/authorization';
import { MasterDataError } from '../../utils/master-data';
import { AuthError, type AuthUser } from '../auth/auth.model';
import { academicResultDisplayPolicy, calculateAcademicIndex } from './academic-result';
import type { HasilStudiReader, HasilStudiRepository } from './hasil-studi.repository';

const managers = ['ADMIN', 'AKADEMIK'] as const;
type Student = NonNullable<Awaited<ReturnType<HasilStudiReader['studentById']>>>;
type Result = Awaited<ReturnType<HasilStudiReader['results']>>[number];

export function createHasilStudiService(repository: HasilStudiRepository) {
  async function activeActor(tx: HasilStudiReader, user: AuthUser, roles: readonly AuthUser['role'][]) {
    requireRole(user, roles);
    const actor = await tx.actor(user.id);
    if (!actor?.isActive || actor.role !== user.role) throw new AuthError(403, 'Akun tidak memiliki izin melihat hasil studi.');
  }
  async function ownStudent(tx: HasilStudiReader, user: AuthUser) {
    await activeActor(tx, user, ['MAHASISWA']);
    const student = await tx.studentByUser(user.id);
    if (!student) throw new MasterDataError(404, 'Akun belum terhubung dengan mahasiswa.');
    return student;
  }
  async function managedStudent(tx: HasilStudiReader, user: AuthUser, studentId: string) {
    await activeActor(tx, user, managers);
    const student = await tx.studentById(studentId);
    if (!student) throw new MasterDataError(404, 'Mahasiswa tidak ditemukan.');
    return student;
  }
  function aggregate(results: readonly Result[]) {
    return calculateAcademicIndex(results.map(result => ({ sks: result.mataKuliah.sks, nilaiIndeks: result.nilaiIndeks })));
  }
  function cumulative(student: Student, results: readonly Result[]) {
    const calculation = aggregate(results);
    const courseSemesters = new Set(results.map(result => result.semester.id));
    const seenCourses = new Set<string>();
    let hasRepeatedCourses = false;
    for (const result of results) {
      if (seenCourses.has(result.mataKuliah.id)) hasRepeatedCourses = true;
      seenCourses.add(result.mataKuliah.id);
    }
    return {
      mahasiswa: student,
      totalSksKumulatif: calculation.totalSks,
      totalBobotKumulatif: calculation.totalWeightedGradePoints,
      ipk: calculation.index,
      jumlahSemester: courseSemesters.size,
      jumlahHasil: results.length,
      hasRepeatedCourses,
      policy: academicResultDisplayPolicy,
    };
  }
  async function summary(tx: HasilStudiReader, student: Student) {
    const results = await tx.results(student.id);
    const grouped = new Map<string, { semester: Result['semester']; results: Result[] }>();
    for (const result of results) {
      const group = grouped.get(result.semester.id) ?? { semester: result.semester, results: [] };
      group.results.push(result);
      grouped.set(result.semester.id, group);
    }
    const semesters = await Promise.all([...grouped.values()].map(async group => {
      const calculation = aggregate(group.results);
      const unfinishedCourseCount = await tx.unfinishedCount(student.id, group.semester.id);
      return {
        semester: group.semester,
        totalSks: calculation.totalSks,
        totalBobot: calculation.totalWeightedGradePoints,
        ips: calculation.index,
        jumlahHasil: group.results.length,
        unfinishedCourseCount,
        provisional: unfinishedCourseCount > 0,
      };
    }));
    return { mahasiswa: student, semesters, cumulative: cumulative(student, results), policy: academicResultDisplayPolicy };
  }
  async function khs(tx: HasilStudiReader, student: Student, semesterId: string) {
    const term = await tx.term(semesterId);
    if (!term) throw new MasterDataError(404, 'Semester tidak ditemukan.');
    const results = await tx.results(student.id, semesterId);
    const calculation = aggregate(results);
    const unfinishedCourseCount = await tx.unfinishedCount(student.id, semesterId);
    return {
      mahasiswa: student,
      semester: term,
      courses: results,
      summary: {
        totalSks: calculation.totalSks,
        totalBobot: calculation.totalWeightedGradePoints,
        ips: calculation.index,
        jumlahHasil: results.length,
        unfinishedCourseCount,
        provisional: unfinishedCourseCount > 0,
      },
      policy: academicResultDisplayPolicy,
    };
  }
  return {
    ownSummary(user: AuthUser) { return repository.read(async tx => summary(tx, await ownStudent(tx, user))); },
    ownKhs(user: AuthUser, semesterId: string) { return repository.read(async tx => khs(tx, await ownStudent(tx, user), semesterId)); },
    ownIpk(user: AuthUser) { return repository.read(async tx => { const student = await ownStudent(tx, user); return cumulative(student, await tx.results(student.id)); }); },
    studentSummary(user: AuthUser, studentId: string) { return repository.read(async tx => summary(tx, await managedStudent(tx, user, studentId))); },
    studentKhs(user: AuthUser, studentId: string, semesterId: string) { return repository.read(async tx => khs(tx, await managedStudent(tx, user, studentId), semesterId)); },
    studentIpk(user: AuthUser, studentId: string) { return repository.read(async tx => { const student = await managedStudent(tx, user, studentId); return cumulative(student, await tx.results(student.id)); }); },
  };
}

export type HasilStudiService = ReturnType<typeof createHasilStudiService>;
