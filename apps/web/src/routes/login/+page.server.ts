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
    const loginId = String(form.get('login_id') ?? '').trim();
    const password = form.get('password');
    if (!/^[0-9]{1,30}$/.test(loginId)) {
      return fail(400, { loginId, message: 'Nomor Induk harus terdiri dari 1–30 digit.' });
    }
    if (typeof password !== 'string' || password.length < 1 || password.length > 1024) {
      return fail(400, { loginId, message: 'Masukkan kata sandi yang valid.' });
    }
    let result;
    try { result = await serverApi(event).auth.login.post({ login_id: loginId, password }); }
    catch { return fail(503, { loginId, message: 'Layanan masuk tidak tersedia. Silakan coba lagi.' }); }
    if (result.error || !result.data?.success) {
      const message = result.status === 401 ? 'Nomor Induk atau kata sandi salah.'
        : result.status === 429 ? 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.'
        : 'Tidak dapat masuk. Silakan coba lagi.';
      return fail(result.status === 401 ? 401 : result.status === 429 ? 429 : 503, { loginId, message });
    }
    saveSession(event, result.response.headers);
    redirect(303, roleAreas[result.data.data.role].path);
  },
};
