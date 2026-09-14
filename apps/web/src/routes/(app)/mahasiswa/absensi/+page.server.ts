import { loadStudentAttendance } from '$lib/server/attendance';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = loadStudentAttendance;
