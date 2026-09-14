import { loadAttendance, saveAttendance } from '$lib/server/attendance';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = event => loadAttendance(event, false);
export const actions: Actions = { default: event => saveAttendance(event, false) };
