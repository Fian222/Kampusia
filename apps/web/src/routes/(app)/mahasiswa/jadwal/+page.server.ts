import { loadStudentSchedule } from '$lib/server/student';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = loadStudentSchedule;
