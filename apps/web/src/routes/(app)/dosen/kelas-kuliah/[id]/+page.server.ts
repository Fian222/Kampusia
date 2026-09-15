import { loadLecturerClass, saveMeeting } from '$lib/server/attendance';
import type { Actions, PageServerLoad } from './$types';
import { loadGrading, saveGrading } from '$lib/server/grading';
export const load: PageServerLoad = async event => ({ ...await loadLecturerClass(event), grading: await loadGrading(event, false) });
export const actions: Actions = { default: event => saveMeeting(event, false), grading: event => saveGrading(event, false) };
