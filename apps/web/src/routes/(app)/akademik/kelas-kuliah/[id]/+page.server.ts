import { loadKelasDetail, saveOffering } from '$lib/server/academic-offerings';
import { saveMeeting } from '$lib/server/attendance';
import type { PageServerLoad, Actions } from './$types';
import { loadGrading, saveGrading } from '$lib/server/grading';
export const load: PageServerLoad = async event => ({ ...await loadKelasDetail(event), grading: await loadGrading(event, true) });
export const actions: Actions = { detail: event => saveOffering(event, 'detail'), meeting: event => saveMeeting(event), grading: event => saveGrading(event, true) };
