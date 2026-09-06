import { loadMaster, saveMaster } from '$lib/server/master-data';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = event => loadMaster(event, 'program-studi');
export const actions: Actions = { default: event => saveMaster(event, 'program-studi') };
