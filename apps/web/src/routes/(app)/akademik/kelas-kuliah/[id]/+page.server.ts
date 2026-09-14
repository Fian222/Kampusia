import { loadKelasDetail, saveOffering } from '$lib/server/academic-offerings';
import { saveMeeting } from '$lib/server/attendance';
import type { PageServerLoad, Actions } from './$types';
export const load: PageServerLoad = loadKelasDetail;
export const actions: Actions = { default: event => saveOffering(event, 'detail'), meeting: event => saveMeeting(event, true) };
