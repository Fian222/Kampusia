import { error, redirect, type Handle } from '@sveltejs/kit';
import { serverApi } from '$lib/server/api';
import { isMasterDataPath, roleAreas, sessionCookie } from '$lib/auth';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  if (event.request.method !== 'GET' && event.request.method !== 'HEAD'
    && event.request.headers.get('origin') !== event.url.origin) {
    error(403, 'Asal permintaan tidak diizinkan.');
  }
  if (event.cookies.get(sessionCookie)) {
    let result;
    try { result = await serverApi(event).auth.me.get(); }
    catch { error(503, 'Layanan autentikasi tidak tersedia. Silakan coba lagi.'); }
    if (result.status === 401) event.cookies.delete(sessionCookie, { path: '/' });
    else if (result.error || !result.data?.success) error(503, 'Layanan autentikasi tidak tersedia.');
    else event.locals.user = result.data.data;
  }
  const passwordChangePath = event.url.pathname === '/change-password';
  if (event.locals.user?.mustChangePassword && !passwordChangePath && event.url.pathname !== '/logout') {
    redirect(303, '/change-password');
  }
  if (event.locals.user && !event.locals.user.mustChangePassword && passwordChangePath) {
    redirect(303, roleAreas[event.locals.user.role].path);
  }
  const area = Object.values(roleAreas).find(area =>
    event.url.pathname === area.path || event.url.pathname.startsWith(area.path + '/'));
  if (area) {
    if (!event.locals.user) redirect(303, '/login');
    const sharedMaster = isMasterDataPath(event.url.pathname) && ['ADMIN', 'AKADEMIK'].includes(event.locals.user.role);
    if (!sharedMaster && roleAreas[event.locals.user.role].path !== area.path) error(403, 'Anda tidak memiliki akses ke halaman ini.');
  }
  const response = await resolve(event);
  response.headers.set('cache-control', 'no-store');
  return response;
};
