import { loadStudentKrs, saveKrs } from '$lib/server/krs';
import type { PageServerLoad, Actions } from './$types';
export const load: PageServerLoad = loadStudentKrs;
export const actions: Actions = { default: event => saveKrs(event) };
