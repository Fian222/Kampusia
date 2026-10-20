import { expect, test } from 'bun:test';

const read = (path: string) => Bun.file(new URL(`../${path}`, import.meta.url)).text();

test('student profile reads only the session-owned profile endpoint', async () => {
  const loader = await read('lib/server/student.ts');
  const page = await read('routes/(app)/mahasiswa/profil/+page.svelte');
  expect(loader).toContain('serverApi(event).mahasiswa.me.get()');
  expect(loader).toContain('studentAccess(event)');
  expect(page).toContain('profile.nim');
  expect(page).toContain('profile.dosenPa?.nama');
  expect(page).toContain('href="/akun/password"');
});

test('student schedule is derived from active KRS selections and flags unapproved plans', async () => {
  const loader = await read('lib/server/student.ts');
  const page = await read('routes/(app)/mahasiswa/jadwal/+page.svelte');
  const layout = await read('routes/(app)/+layout.svelte');
  expect(loader).toContain('serverApi(event).mahasiswa.me.krs');
  expect(page).toContain("item.status === 'AKTIF'");
  expect(page).toContain("plan.status !== 'DISETUJUI'");
  expect(page).toContain('Belum dijadwalkan');
  expect(layout).toContain("{ path: '/mahasiswa/jadwal', label: 'Jadwal Kuliah', icon: 'calendar' }");
  expect(layout).toContain("{ path: '/mahasiswa/profil', label: 'Profil', icon: 'user' }");
});
