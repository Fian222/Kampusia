import { loadAdviserKrsDetail, saveAdviserKrs } from '$lib/server/krs';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = loadAdviserKrsDetail;
export const actions: Actions = { default: saveAdviserKrs };
