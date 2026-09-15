import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { serverApi } from './api';
import { read } from './academic-offerings';
import { requireMasterAccess } from './master-data';

function studentAccess(event: RequestEvent) {
  if (!event.locals.user) redirect(303, '/login');
  if (event.locals.user.role !== 'MAHASISWA') error(403, 'Akses khusus mahasiswa.');
}

export async function loadAcademicResults(event: RequestEvent, managed = false) {
  if (managed) requireMasterAccess(event); else studentAccess(event);
  const client = serverApi(event);
  const studentId = managed ? event.params.id! : null;
  const summaryResponse = await (studentId
    ? read(client.mahasiswa({ id: studentId })['hasil-studi'].get())
    : read(client.mahasiswa.me['hasil-studi'].get()));
  const summary = summaryResponse.data;
  const requestedSemester = event.url.searchParams.get('semester_id');
  const selectedSemesterId = summary.semesters.some(item => item.semester.id === requestedSemester)
    ? requestedSemester!
    : summary.semesters[0]?.semester.id ?? null;
  const khsResponse = selectedSemesterId
    ? await (studentId
      ? read(client.mahasiswa({ id: studentId }).khs({ semesterId: selectedSemesterId }).get())
      : read(client.mahasiswa.me.khs({ semesterId: selectedSemesterId }).get()))
    : null;
  return { managed, summary, ipk: summary.cumulative, khs: khsResponse?.data ?? null, selectedSemesterId };
}

export type AcademicResultsData = Awaited<ReturnType<typeof loadAcademicResults>>;
