# Authentication and authorization

The authentication flow uses existing `users` records and Bun password verification. Successful responses expose only `id`, `loginId`, optional contact `email`, and `role`. Unknown or null Nomor Induk values, incorrect passwords, and inactive accounts receive the same 401 response. Login accepts a one-through-30 digit `login_id` string, preserves leading zeroes, and limits attempts per normalized identifier to 20 in a 15-minute window within the API process. Email is not a login fallback.

## API contract

Account eligibility is controlled by `users.is_active`, independently of `mahasiswa.status`. A linked student with status CUTI, NONAKTIF, LULUS, or KELUAR can authenticate and retain a session when their user account is active. Conversely, an AKTIF student cannot authenticate through an inactive user account. Academic-status restrictions belong to academic actions such as KRS submission and approval, not login, session validation, or dashboard role guards.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/auth/login` | Accept `{ login_id, password }`, set session cookie, return safe user |
| POST | `/auth/logout` | Revoke the supplied session and expire the cookie; safe to repeat |
| GET | `/auth/me` | Return current safe user or 401 |
| GET | `/dashboard/:area` | Require login and the matching role; return area and safe user |

Responses use `{ success: true, data }` or `{ success: false, message }`. Missing/expired authentication returns 401; insufficient role permissions or a rejected origin returns 403. Malformed login input returns 400. Login throttling returns 429. Login and logout require an `Origin` header matching `WEB_URL` exactly.

The reusable `authorization` plugin resolves the current user from the cookie. `requireRole` enforces an explicit allowlist on protected endpoints. Future protected API routes must use these guards, independently of frontend navigation.

## Sessions and cookies

Sessions use cryptographically random 256-bit opaque tokens. The API stores token digests in memory with an eight-hour absolute expiry; the browser receives a host-only `kampusia_session` cookie with `HttpOnly`, `SameSite=Lax`, and `Path=/`. Cookies are `Secure` in production and allow HTTP in local development. Login rotates a presented session; logout revokes it immediately. Each authenticated request rereads the user so deactivation, deletion, password changes, and role changes take effect without waiting for expiry.

**This initial session store supports one API process.** API restarts (including watch reloads) sign everyone out. Multiple API instances require a shared session store before deployment. There are no new database tables or migrations. Session and login-attempt maps are bounded to 10,000 entries each; process-local throttling should be supplemented by deployment-level rate limits for a public service.

The browser submits same-origin SvelteKit form actions. SvelteKit uses Eden Treaty from server-only modules, forwards only the session cookie, and relays the login cookie. Tokens are never returned in browser JSON or stored in localStorage. SvelteKit checks the origin of mutation requests, and the API checks the configured web origin for login/logout. Authenticated responses are marked `Cache-Control: no-store`.

## Web areas

| Role | Dashboard |
| --- | --- |
| ADMIN | `/admin` |
| AKADEMIK | `/akademik` |
| DOSEN | `/dosen` |
| MAHASISWA | `/mahasiswa` |

Each role can access its own dashboard. ADMIN does not implicitly bypass other role checks. The SvelteKit server hook checks access on every request, and dashboard loads also call the protected API endpoint. Unauthenticated visitors go to `/login`; authenticated visitors requesting another role's area receive 403. All areas share a responsive sidebar, Nomor Induk-first user information, optional contact email, and logout form.

The explicitly shared master-data pages `/akademik/fakultas` and `/akademik/program-studi` allow both ADMIN and AKADEMIK. Their loads and form actions enforce that allowlist, as do all Fakultas and Program Studi API endpoints. Master-data mutations also verify `Origin` against `WEB_URL`. This exception does not grant ADMIN access to the AKADEMIK dashboard or other role areas.

## Environment and deployment

- API: `DATABASE_URL`, `API_PORT`, `WEB_URL`, and `NODE_ENV`. In production, `WEB_URL` must be an HTTPS origin and `NODE_ENV=production` enables secure API cookies.
- Web: private `API_URL` pointing to the API. Production builds use secure cookies. Keep API traffic on a trusted private connection or HTTPS.
- Configure the eventual SvelteKit deployment adapter and trusted proxy/origin settings so `event.url.origin` is the public HTTPS origin matching `WEB_URL`. The existing adapter-auto build does not itself provide a production deployment.

No JWT signing secret is needed for opaque sessions. Keep actual environment values in ignored `.env` files. Demo credentials and the live integration-test command are documented only in [development documentation](DEVELOPMENT.md).
