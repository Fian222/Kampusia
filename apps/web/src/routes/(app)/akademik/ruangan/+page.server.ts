import { loadRuangan, saveRuangan } from '$lib/server/ruangan';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = loadRuangan;
export const actions: Actions = { default: saveRuangan };
