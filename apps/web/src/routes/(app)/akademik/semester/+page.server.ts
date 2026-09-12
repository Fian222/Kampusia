import { loadSemester, saveOffering } from '$lib/server/academic-offerings';
import type { PageServerLoad, Actions } from './$types';
export const load: PageServerLoad = loadSemester;
export const actions: Actions = { default: event => saveOffering(event, 'semester') };
