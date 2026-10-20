import { error, type RequestEvent } from '@sveltejs/kit';
import { serverApi } from './api';
import { resultError, studentAccess } from './krs';
import { apiMessage, integer } from './master-data';

export async function loadStudentProfile(event: RequestEvent) {
  studentAccess(event);
  const result = await serverApi(event).mahasiswa.me.get().catch(() => error(503, apiMessage(null)));
  if (result.error || !result.data?.success) resultError(result.status, result.error?.value);
  return { profile: result.data.data };
}

/** Weekly timetable derived from the student's KRS selections; no schedule is stored per student. */
export async function loadStudentSchedule(event: RequestEvent) {
  studentAccess(event);
  const client = serverApi(event).mahasiswa.me.krs;
  const params = event.url.searchParams;
  const history = await client.get({ query: { page: integer(params.get('history_page'), 1, 1000000), limit: 20 } }).catch(() => error(503, apiMessage(null)));
  if (history.error || !history.data?.success) resultError(history.status, history.error?.value);
  const semesterId = params.get('semester_id') || history.data.activeSemester?.id;
  const term = semesterId ? await client({ id: semesterId }).get().catch(() => error(503, apiMessage(null))) : null;
  if (term && (term.error || !term.data?.success)) resultError(term.status, term.error?.value);
  return { history: history.data, selected: term?.data?.success ? term.data.data : null, semesterId: semesterId ?? null };
}
