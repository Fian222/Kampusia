import { loadLecturerClass, saveMeeting } from '$lib/server/attendance';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = loadLecturerClass;
export const actions: Actions = { default: event => saveMeeting(event, false) };
