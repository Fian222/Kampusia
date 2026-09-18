import { loadSemester, saveOffering, saveSemesterKrsPeriod } from '$lib/server/academic-offerings';
import type { PageServerLoad, Actions } from './$types';
export const load: PageServerLoad = loadSemester;
export const actions: Actions = {
  semester: event => saveOffering(event, 'semester'),
  krsPeriod: saveSemesterKrsPeriod,
};
