import { redirect } from '@sveltejs/kit';
import { roleAreas } from '$lib/auth';
import { submitPasswordChange } from '$lib/server/password';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) redirect(303, '/login');
  if (!locals.user.mustChangePassword) redirect(303, roleAreas[locals.user.role].path);
  return { user: locals.user };
};

export const actions: Actions = {
  default: async event => {
    const result = await submitPasswordChange(event, { requireCurrent: false });
    if ('user' in result) redirect(303, roleAreas[result.user.role].path);
    return result;
  },
};
