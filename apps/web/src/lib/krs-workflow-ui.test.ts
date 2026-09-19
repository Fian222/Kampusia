import { expect, test } from 'bun:test';

const read = (path: string) => Bun.file(new URL(path, import.meta.url)).text();

test('student KRS UI exposes the period-aware course-selection workflow', async () => {
  const [page, action, courses, server] = await Promise.all([
    read('../routes/(app)/mahasiswa/krs/+page.svelte'),
    read('./components/KrsAction.svelte'),
    read('./components/KrsCourseList.svelte'),
    read('./server/krs.ts'),
  ]);

  // DRAFT exposes selection controls, while every mutation remains period-gated.
  expect(page).toContain("plan?.status === 'DRAFT'");
  expect(page).toContain('actionsEnabled={editable}');
  expect(page).toContain("plan?.status === 'DRAFT' && editable");
  expect(page).toContain('data.period?.open');
  expect(courses).toContain('name="mode" value="add"');
  expect(courses).toContain('name="mode" value="remove"');

  // Review states have explicit, read-only workflow messages.
  expect(page).toContain("plan.status === 'DIAJUKAN'");
  expect(page).toContain('Menunggu persetujuan Dosen PA');
  expect(page).toContain("plan.status === 'DITOLAK'");
  expect(page).toContain('Alasan penolakan');
  expect(page).toContain('Perbaiki KRS');
  expect(page).toContain("plan.status === 'DISETUJUI'");
  expect(page).toContain('bersifat baca-saja');
  expect(page).toContain("plan.status === 'DIBATALKAN'");

  // Credit values remain derived from the authoritative response.
  expect(page).toContain('{plan.totalSks}');
  expect(page).toContain('{plan.batasSks}');
  expect(page).toContain('{plan.remainingSks}');
  expect(page).toContain('aria-valuetext={`${plan.totalSks} dari ${plan.batasSks} SKS dipilih`}');

  // Clearing stays distinct from lifecycle cancellation and submission is explicit.
  expect(page).toContain('label="Kosongkan KRS"');
  expect(page).toContain('Semua mata kuliah yang dipilih akan dikeluarkan dari KRS.');
  expect(page).not.toContain('Batalkan KRS');
  expect(page).toContain('label="Ajukan KRS ke Dosen PA"');
  expect(server).toContain("submit: 'KRS berhasil diajukan dan sedang menunggu peninjauan Dosen PA.'");

  // URL-backed filtering and enhanced mutations preserve in-page interaction.
  expect(page).toContain('use:seamlessFilter');
  expect(page).toContain('<ListPending />');
  expect(page).not.toContain('Memuat data...');
  expect(courses).toContain('use:enhance={submit}');
  expect(courses).toContain('await update({ reset: false, invalidateAll: true })');
  expect(action).toContain('<Modal bind:open');
  expect(action).toContain('reasonLabel');

  // Stacked rows retain accessible labels on compact actions.
  expect(courses).not.toContain('<table');
  expect(courses).toContain('aria-label={`Ambil ${kelas.mataKuliah.nama}, kelas ${kelas.namaKelas}`}');
  expect(courses).toContain('aria-label={`Keluarkan ${kelas.mataKuliah.nama}, kelas ${kelas.namaKelas} dari KRS`}');
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

test('Mahasiswa UI includes a searchable, nullable active Dosen PA selector', async () => {
  const [profile, loader] = await Promise.all([read('./components/ProfilePage.svelte'), read('./server/academic-profiles.ts')]);
  expect(profile).toContain('name="dosen_pa_id" label="Dosen PA"'); expect(profile).toContain('pageParam="adviser_page"'); expect(profile).toContain('nullable help='); expect(loader).toContain("is_active: 'true'");
});
