import { loadKelas, saveOffering } from '$lib/server/academic-offerings';
import type { PageServerLoad, Actions } from './$types';
export const load: PageServerLoad = loadKelas;
export const actions: Actions = { default: event => saveOffering(event, 'kelas') };
