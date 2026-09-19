import { fail, redirect } from '@sveltejs/kit';
import { roleAreas } from '$lib/auth';
import { saveSession, serverApi } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) redirect(303, '/login');
  if (!locals.user.mustChangePassword) redirect(303, roleAreas[locals.user.role].path);
  return { user: locals.user };
};

export const actions: Actions = {
  default: async event => {
    if (!event.locals.user) redirect(303, '/login');
    const form = await event.request.formData();
    const newPassword = form.get('new_password');
    const confirmation = form.get('confirmation');
    if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 1024) {
      return fail(400, { message: 'Kata sandi baru harus terdiri dari 12–1024 karakter.' });
    }
    if (typeof confirmation !== 'string' || newPassword !== confirmation) {
      return fail(400, { message: 'Konfirmasi kata sandi tidak sama.' });
    }
    let result;
    try { result = await serverApi(event).auth['change-password'].post({ new_password: newPassword, confirmation }); }
    catch { return fail(503, { message: 'Layanan perubahan kata sandi tidak tersedia.' }); }
    if (result.status === 401) redirect(303, '/login');
    if (result.error || !result.data?.success) {
      return fail(result.status === 400 ? 400 : 503, { message: 'Kata sandi tidak dapat diubah. Silakan coba lagi.' });
    }
    saveSession(event, result.response.headers);
    redirect(303, roleAreas[result.data.data.role].path);
  },
};
