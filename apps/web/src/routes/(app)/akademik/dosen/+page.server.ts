import { loadProfiles, saveProfile } from '$lib/server/academic-profiles';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = event => loadProfiles(event, 'dosen');
export const actions: Actions = { default: event => saveProfile(event, 'dosen') };
