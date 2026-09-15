import { loadAcademicResults } from '$lib/server/academic-results';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = event => loadAcademicResults(event);
