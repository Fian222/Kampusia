import { loadStudentProfile } from '$lib/server/student';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = loadStudentProfile;
