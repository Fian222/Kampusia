import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { serverApi } from './api';
import { roleAreas } from '$lib/auth';
import type { Role } from 'api';

export async function loadDashboard(event: RequestEvent, role: Role) {
  if (!event.locals.user) redirect(303, '/login');
  if (event.locals.user.role !== role) error(403, 'Anda tidak memiliki akses ke halaman ini.');
  let result;
  try { result = await serverApi(event).dashboard({ area: roleAreas[role].area }).get(); }
  catch { error(503, 'Layanan dashboard tidak tersedia.'); }
  if (result.status === 401) redirect(303, '/login');
  if (result.status === 403) error(403, 'Anda tidak memiliki akses ke halaman ini.');
  if (result.error || !result.data?.success) error(503, 'Layanan dashboard tidak tersedia.');
  return { user: result.data.data.user };
}
