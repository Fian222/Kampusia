import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { serverApi } from './api';
import { roleAreas } from '$lib/auth';
import type { Role } from 'api';
import { read } from './academic-offerings';

export async function loadDashboard(event: RequestEvent, role: Role) {
  if (!event.locals.user) redirect(303, '/login');
  if (event.locals.user.role !== role) error(403, 'Anda tidak memiliki akses ke halaman ini.');
  let result;
  try { result = await serverApi(event).dashboard({ area: roleAreas[role].area }).get(); }
  catch { error(503, 'Layanan dashboard tidak tersedia.'); }
  if (result.status === 401) redirect(303, '/login');
  if (result.status === 403) error(403, 'Anda tidak memiliki akses ke halaman ini.');
  if (result.error || !result.data?.success) error(503, 'Layanan dashboard tidak tersedia.');
  const user = result.data.data.user;
  const client = serverApi(event);

  if (role === 'ADMIN' || role === 'AKADEMIK') {
    const [semesters, students, lecturers, classes, pendingKrs] = await Promise.all([
      read(client.semester.get({ query: { page: 1, limit: 1, search: '', is_active: 'true' } })),
      read(client.mahasiswa.get({ query: { page: 1, limit: 1, search: '' } })),
      read(client.dosen.get({ query: { page: 1, limit: 1, search: '' } })),
      read(client['kelas-kuliah'].get({ query: { page: 1, limit: 1, search: '' } })),
      read(client.krs.get({ query: { page: 1, limit: 1, search: '', status: 'DIAJUKAN' } })),
    ]);
    return {
      user,
      kind: 'manager' as const,
      manager: {
        activeSemester: semesters.data[0] ?? null,
        studentTotal: students.meta.total,
        lecturerTotal: lecturers.meta.total,
        classTotal: classes.meta.total,
        pendingKrsTotal: pendingKrs.meta.total,
      },
    };
  }

  if (role === 'DOSEN') {
    const [classes, pendingKrs] = await Promise.all([
      read(client.dosen.me['kelas-kuliah'].get({ query: { page: 1, limit: 3, search: '' } })),
      read(client.dosen.me.krs.get({ query: { page: 1, limit: 1, search: '' } })),
    ]);
    const gradingRows = await Promise.all(classes.data.map(async kelas => ({
      classId: kelas.id,
      grading: (await read(client['kelas-kuliah']({ id: kelas.id }).nilai.get())).data,
    })));
    const gradingByClass = Object.fromEntries(gradingRows.map(row => [row.classId, row.grading]));
    const unfinished = gradingRows.filter(row => !row.grading.summary.finalized && (row.grading.summary.activeWeight !== '100.00' || row.grading.summary.missingScores > 0));
    const readyToFinalize = gradingRows.filter(row => row.grading.permissions.canFinalize && row.grading.kelas.status === 'DITUTUP' && row.grading.summary.activeWeight === '100.00' && row.grading.summary.missingScores === 0 && row.grading.summary.totalStudents > 0);
    return { user, kind: 'lecturer' as const, lecturer: { classes, pendingKrsTotal: pendingKrs.meta.total, gradingByClass, gradingNeedsAttention: unfinished.length, readyToFinalize: readyToFinalize.length } };
  }

  const [history, results, attendance] = await Promise.all([
    read(client.mahasiswa.me.krs.get({ query: { page: 1, limit: 1 } })),
    read(client.mahasiswa.me['hasil-studi'].get()),
    read(client.mahasiswa.me.absensi.get({ query: { page: 1, limit: 1, search: '' } })),
  ]);
  const current = history.activeSemester
    ? await read(client.mahasiswa.me.krs({ id: history.activeSemester.id }).get())
    : null;
  return {
    user,
    kind: 'student' as const,
    student: {
      activeSemester: history.activeSemester,
      currentKrs: current?.data.krs ?? null,
      dosenPa: current?.data.dosenPa ?? null,
      cumulative: results.data.cumulative,
      latestSemesterResult: results.data.semesters[0] ?? null,
      attendanceTotal: attendance.meta.total,
    },
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
