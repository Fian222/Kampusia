import { loadCatalog, saveCatalog } from '$lib/server/course-catalog';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = event => loadCatalog(event, 'mata-kuliah');
export const actions: Actions = { default: event => saveCatalog(event, 'mata-kuliah') };
