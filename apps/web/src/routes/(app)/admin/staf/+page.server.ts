import { loadStaf, saveStaf } from '$lib/server/staf';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = loadStaf;
export const actions: Actions = { default: saveStaf };
