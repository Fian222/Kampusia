import { expect, test } from 'bun:test';

const read = (path: string) => Bun.file(new URL(path, import.meta.url)).text();

test('student KRS UI exposes period-aware workflow controls and rejection context', async () => {
  const [page, action, summary] = await Promise.all([
    read('../routes/(app)/mahasiswa/krs/+page.svelte'), read('./components/KrsAction.svelte'), read('./components/KrsSummary.svelte'),
  ]);
  expect(page).toContain('Kosongkan KRS'); expect(page).toContain('Menunggu persetujuan Dosen PA'); expect(page).toContain('data.period?.open');
  expect(action).toContain('reasonLabel'); expect(summary).toContain('Alasan penolakan'); expect(summary).toContain('Dosen PA:');
});

test('Dosen PA and Semester UI expose scoped review and Jakarta KRS-window controls', async () => {
  const [list, detail, semester, navigation] = await Promise.all([
    read('../routes/(app)/dosen/krs/+page.svelte'), read('../routes/(app)/dosen/krs/[id]/+page.svelte'),
    read('../routes/(app)/akademik/semester/+page.svelte'), read('../routes/(app)/+layout.svelte'),
  ]);
  expect(list).toContain('Bimbingan KRS'); expect(detail).toContain('Alasan penolakan'); expect(detail).toContain('periodOpen');
  expect(semester).toContain('datetime-local'); expect(semester).toContain('Asia/Jakarta'); expect(navigation).toContain('/dosen/krs');
});

test('Mahasiswa UI includes a paginated active Dosen PA selector', async () => {
  const [profile, loader] = await Promise.all([read('./components/ProfilePage.svelte'), read('./server/academic-profiles.ts')]);
  expect(profile).toContain('Dosen PA (opsional)'); expect(profile).toContain('adviser_page'); expect(loader).toContain("is_active: 'true'");
});
