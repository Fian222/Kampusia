import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { saveSession, serverApi } from './api';

/** Shared form action for both the forced temporary-password change and the voluntary change. */
export async function submitPasswordChange(event: RequestEvent, options: { requireCurrent: boolean }) {
  if (!event.locals.user) redirect(303, '/login');
  const form = await event.request.formData();
  const currentPassword = form.get('current_password');
  const newPassword = form.get('new_password');
  const confirmation = form.get('confirmation');
  if (options.requireCurrent && (typeof currentPassword !== 'string' || !currentPassword)) {
    return fail(400, { message: 'Masukkan kata sandi saat ini.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 1024) {
    return fail(400, { message: 'Kata sandi baru harus terdiri dari 12–1024 karakter.' });
  }
  if (typeof confirmation !== 'string' || newPassword !== confirmation) {
    return fail(400, { message: 'Konfirmasi kata sandi tidak sama.' });
  }
  let result;
  try {
    result = await serverApi(event).auth['change-password'].post({
      new_password: newPassword,
      confirmation,
      ...(options.requireCurrent ? { current_password: currentPassword as string } : {}),
    });
  } catch { return fail(503, { message: 'Layanan perubahan kata sandi tidak tersedia.' }); }
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data?.success) {
    const value = result.error?.value as { message?: unknown } | undefined;
    const message = result.status === 400 && typeof value?.message === 'string' ? value.message
      : result.status === 429 ? 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.'
      : 'Kata sandi tidak dapat diubah. Silakan coba lagi.';
    return fail(result.status === 400 || result.status === 429 ? result.status : 503, { message });
  }
  saveSession(event, result.response.headers);
  return { user: result.data.data };
}
