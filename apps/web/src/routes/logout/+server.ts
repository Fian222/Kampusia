import { error, redirect } from '@sveltejs/kit';
import { serverApi } from '$lib/server/api';
import { sessionCookie } from '$lib/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async event => {
  let result;
  try { result = await serverApi(event).auth.logout.post(); }
  catch { error(503, 'Tidak dapat keluar saat ini. Silakan coba lagi.'); }
  if (result.error) error(503, 'Tidak dapat keluar saat ini. Silakan coba lagi.');
  event.cookies.delete(sessionCookie, { path: '/' });
  redirect(303, '/login');
};
