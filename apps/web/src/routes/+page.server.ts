import { redirect } from '@sveltejs/kit';
import { roleAreas } from '$lib/auth';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals }) => {
  redirect(303, locals.user ? (locals.user.mustChangePassword ? '/change-password' : roleAreas[locals.user.role].path) : '/login');
};
