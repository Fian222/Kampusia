import { expect, test } from 'bun:test';

const source = async (path: string) => Bun.file(new URL(path, import.meta.url)).text();

test('login form uses a digit-string Nomor Induk field and has no email credential field', async () => {
  const page = await source('../routes/login/+page.svelte');
  const action = await source('../routes/login/+page.server.ts');
  expect(page).toContain('Nomor Induk');
  expect(page).toContain('name="login_id"');
  expect(page).toContain('type="text"');
  expect(page).toContain('inputmode="numeric"');
  expect(page).not.toContain('name="email"');
  expect(page).not.toContain('type="number"');
  expect(action).toContain("login_id: loginId");
  expect(action).not.toContain("form.get('email')");
});

test('profile forms use read-only deterministic account status and text identity inputs', async () => {
  const page = await source('./components/ProfilePage.svelte');
  const server = await source('./server/academic-profiles.ts');
  expect(page).not.toContain('name="user_id"');
  expect(page).not.toContain('Hubungkan akun');
  expect(page).not.toContain('Lepaskan akun');
  expect(page).toContain('Akun Login');
  expect(page).toContain('Belum memiliki akun login');
  expect(page).toContain('Buat Akun Login');
  expect(page).toContain('Reset Password');
  const credentialModal = await source('./components/TemporaryCredentialModal.svelte');
  expect(page).toContain('<TemporaryCredentialModal');
  expect(credentialModal).toContain('Salin Password');
  expect(credentialModal).toContain('Password ini hanya ditampilkan sekali.');
  expect(credentialModal).not.toContain('localStorage');
  expect(page).toContain('credential = null');
  expect(page).not.toContain('localStorage');
  expect(page).not.toContain('sessionStorage');
  expect(server).not.toContain('temporaryPassword: params');
  expect(page).toContain('data.edit.account.loginId');
  expect(page).toContain('data.edit.account.isActive');
  expect(page).toContain('name="nim" type="text" inputmode="numeric"');
  expect(page).toContain('name="nik" type="text" inputmode="numeric"');
  expect(page).not.toContain('data.edit.account.id');
  expect(server).not.toContain("'user_id'");
  expect(server).not.toContain("['account-options']");
});

test('temporary-password users are routed to a dedicated password-change flow', async () => {
  const hook = await source('../hooks.server.ts');
  const login = await source('../routes/login/+page.server.ts');
  const page = await source('../routes/change-password/+page.svelte');
  const action = await source('../routes/change-password/+page.server.ts');
  const helper = await source('server/password.ts');
  expect(hook).toContain("redirect(303, '/change-password')");
  expect(login).toContain("? '/change-password'");
  expect(page).toContain('Anda menggunakan password sementara.');
  expect(page).toContain('name="new_password"');
  expect(page).toContain('name="confirmation"');
  expect(action).toContain('submitPasswordChange(event, { requireCurrent: false })');
  expect(helper).toContain("auth['change-password']");
});

test('signed-in users can change their password after confirming the current one', async () => {
  const page = await source('../routes/(app)/akun/password/+page.svelte');
  const action = await source('../routes/(app)/akun/password/+page.server.ts');
  const layout = await source('../routes/(app)/+layout.svelte');
  expect(page).toContain('name="current_password"');
  expect(page).toContain('autocomplete="current-password"');
  expect(action).toContain('submitPasswordChange(event, { requireCurrent: true })');
  expect(layout).toContain('href="/akun/password"');
});

test('authenticated account presentation prefers Nomor Induk over email', async () => {
  const layout = await source('../routes/(app)/+layout.svelte');
  expect(layout).toContain('Nomor Induk');
  expect(layout).toContain('data.user.loginId');
  expect(layout.indexOf('data.user.loginId')).toBeLessThan(layout.indexOf('data.user.email'));
});

test('ADMIN manages staff accounts by Nomor Induk without exposing account UUIDs', async () => {
  const page = await source('../routes/(app)/admin/staf/+page.svelte');
  const server = await source('server/staf.ts');
  const layout = await source('../routes/(app)/+layout.svelte');
  expect(server).toContain("event.locals.user.role !== 'ADMIN'");
  expect(server).toContain("client({ loginId: values.login_id! })['reset-password'].post()");
  expect(page).toContain('<TemporaryCredentialModal');
  expect(page).not.toContain('name="id"');
  expect(page).toContain('{#if !self}');
  expect(layout).toContain("{ path: '/admin/staf', label: 'Akun Staf', icon: 'users' }");
  expect(layout).toContain("data.user.role === 'ADMIN' ? adminGroups");
});
