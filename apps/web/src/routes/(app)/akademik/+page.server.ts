import { loadDashboard } from '$lib/server/dashboard';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = event => loadDashboard(event, 'AKADEMIK');
