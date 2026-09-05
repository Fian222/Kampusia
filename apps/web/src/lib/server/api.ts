import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import type { RequestEvent } from '@sveltejs/kit';
import { createApiClient } from '$lib/api';
import { sessionCookie } from '$lib/auth';

export function serverApi(event: RequestEvent) {
  const url = env.API_URL ?? (dev ? 'http://localhost:3000' : '');
  if (!url) throw new Error('API_URL is required.');
  const token = event.cookies.get(sessionCookie);
  return createApiClient(url, {
    origin: event.url.origin,
    ...(token && /^[a-f0-9]{64}$/.test(token) ? { cookie: sessionCookie + '=' + token } : {}),
  });
}

export function saveSession(event: RequestEvent, headers: Headers) {
  const cookie = headers.getSetCookie().find(value => value.startsWith(sessionCookie + '='));
  const token = cookie?.split(';')[0]?.slice(sessionCookie.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new Error('Missing session cookie.');
  event.cookies.set(sessionCookie, token, {
    path: '/', httpOnly: true, sameSite: 'lax', secure: !dev, maxAge: 8 * 60 * 60,
  });
}
