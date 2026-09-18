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

test('Semester uses a dedicated, prefilled KRS-period modal and named server action', async () => {
  const [page, server, handlers] = await Promise.all([
    read('../routes/(app)/akademik/semester/+page.svelte'),
    read('../routes/(app)/akademik/semester/+page.server.ts'),
    read('./server/academic-offerings.ts'),
  ]);
  expect(page).toContain('Atur Periode KRS');
  expect(page).toContain('href={href({ edit: \'\', modal: \'\', krs_period: row.id })} data-sveltekit-noscroll data-sveltekit-keepfocus');
  expect(page).toContain('action="?/krsPeriod"');
  expect(server).toContain('krsPeriod: saveSemesterKrsPeriod');
  expect(handlers).toContain("['krs-period'].patch(body)");

  const editModal = page.slice(page.indexOf('<Modal bind:open={formOpen}'), page.indexOf('<Modal bind:open={periodOpen}'));
  expect(editModal).not.toContain("name: 'krs_mulai_at'");
  expect(editModal).not.toContain("name: 'krs_selesai_at'");
  const periodModal = page.slice(page.indexOf('<Modal bind:open={periodOpen}'));
  expect(periodModal).toContain('jakartaDateTimeLocal(data.krsPeriod?.krsMulaiAt)');
  expect(periodModal).toContain('jakartaDateTimeLocal(data.krsPeriod?.krsSelesaiAt)');
  expect(page).toContain("const periodSaveFailed = $derived(form?.values?.mode === 'krs-period' && !form.saved)");
  expect(periodModal).toContain("if (result.type === 'success') periodOpen = false");
  expect(periodModal).toContain('goto(href({ krs_period: \'\' }), { replaceState: true, ...modalNavigationOptions })');
});

test('Mahasiswa UI includes a paginated active Dosen PA selector', async () => {
  const [profile, loader] = await Promise.all([read('./components/ProfilePage.svelte'), read('./server/academic-profiles.ts')]);
  expect(profile).toContain('Dosen PA (opsional)'); expect(profile).toContain('adviser_page'); expect(loader).toContain("is_active: 'true'");
});
