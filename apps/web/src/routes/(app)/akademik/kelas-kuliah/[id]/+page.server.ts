import { loadKelasDetail, saveOffering } from '$lib/server/academic-offerings';
import type { PageServerLoad, Actions } from './$types';
export const load: PageServerLoad = loadKelasDetail;
export const actions: Actions = { default: event => saveOffering(event, 'dosen') };
