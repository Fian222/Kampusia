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
  expect(page).toContain('data.edit.account.loginId');
  expect(page).toContain('data.edit.account.isActive');
  expect(page).toContain('name="nim" type="text" inputmode="numeric"');
  expect(page).toContain('name="nik" type="text" inputmode="numeric"');
  expect(page).not.toContain('data.edit.account.id');
  expect(server).not.toContain("'user_id'");
  expect(server).not.toContain("['account-options']");
});

test('authenticated account presentation prefers Nomor Induk over email', async () => {
  const layout = await source('../routes/(app)/+layout.svelte');
  expect(layout).toContain('Nomor Induk');
  expect(layout).toContain('data.user.loginId');
  expect(layout.indexOf('data.user.loginId')).toBeLessThan(layout.indexOf('data.user.email'));
});
