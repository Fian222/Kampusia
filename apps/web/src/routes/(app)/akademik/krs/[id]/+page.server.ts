import { loadKrsDetail, saveKrs } from '$lib/server/krs';
import type { PageServerLoad, Actions } from './$types';
export const load: PageServerLoad = loadKrsDetail;
export const actions: Actions = { default: event => saveKrs(event, true) };
