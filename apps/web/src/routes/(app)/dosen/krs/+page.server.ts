import { loadAdviserKrsList } from '$lib/server/krs';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = loadAdviserKrsList;
