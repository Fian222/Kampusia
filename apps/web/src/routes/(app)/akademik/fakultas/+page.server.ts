import { loadMaster, saveMaster } from '$lib/server/master-data';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = event => loadMaster(event, 'fakultas');
export const actions: Actions = { default: event => saveMaster(event, 'fakultas') };
