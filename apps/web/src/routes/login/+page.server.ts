import { fail, redirect } from '@sveltejs/kit';
import { roleAreas } from '$lib/auth';
import { saveSession, serverApi } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) redirect(303, roleAreas[locals.user.role].path);
};
export const actions: Actions = {
  default: async event => {
    const form = await event.request.formData();
    const email = String(form.get('email') ?? '').trim();
    const password = form.get('password');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return fail(400, { email, message: 'Masukkan alamat email yang valid.' });
    }
    if (typeof password !== 'string' || password.length < 1 || password.length > 1024) {
      return fail(400, { email, message: 'Masukkan kata sandi yang valid.' });
    }
    let result;
    try { result = await serverApi(event).auth.login.post({ email, password }); }
    catch { return fail(503, { email, message: 'Layanan masuk tidak tersedia. Silakan coba lagi.' }); }
    if (result.error || !result.data?.success) {
      const message = result.status === 401 ? 'Email atau kata sandi salah.'
        : result.status === 429 ? 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.'
        : 'Tidak dapat masuk. Silakan coba lagi.';
      return fail(result.status === 401 ? 401 : result.status === 429 ? 429 : 503, { email, message });
    }
    saveSession(event, result.response.headers);
    redirect(303, roleAreas[result.data.data.role].path);
  },
};
