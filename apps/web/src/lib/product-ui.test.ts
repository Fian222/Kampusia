import { expect, test } from 'bun:test';

const read = (path: string) => Bun.file(new URL(path, import.meta.url)).text();

test('dashboards use authoritative role-specific academic data', async () => {
  const [component, loader] = await Promise.all([
    read('./components/Dashboard.svelte'),
    read('./server/dashboard.ts'),
  ]);

  expect(component).toContain("data.kind === 'manager'");
  expect(component).toContain("data.kind === 'lecturer'");
  expect(component).toContain('Ringkasan akademik mahasiswa');
  expect(loader).toContain("client['kelas-kuliah'].get");
  expect(loader).toContain('client.dosen.me.krs.get');
  expect(loader).toContain("client.mahasiswa.me['hasil-studi'].get()");
  expect(loader).toContain('attendance.meta.total');
});

test('core academic workspaces expose clear hierarchy and focused actions', async () => {
  const [semester, classes, classDetail, lecturerDetail, profiles, results] = await Promise.all([
    read('../routes/(app)/akademik/semester/+page.svelte'),
    read('../routes/(app)/akademik/kelas-kuliah/+page.svelte'),
    read('../routes/(app)/akademik/kelas-kuliah/[id]/+page.svelte'),
    read('../routes/(app)/dosen/kelas-kuliah/[id]/+page.svelte'),
    read('./components/ProfilePage.svelte'),
    read('./components/AcademicResults.svelte'),
  ]);

  expect(semester).toContain('Semester aktif');
  expect(semester).toContain('Periode KRS:');
  expect(classes).toContain('Buka kelas');
  expect(classes).toContain('row.dosen?.map');
  expect(classDetail).toContain('aria-label="Bagian ruang kerja kelas"');
  expect(classDetail).toContain("['#pertemuan', 'Pertemuan']");
  expect(lecturerDetail).toContain('Pertemuan & absensi');
  expect(profiles).toContain('Hasil Studi');
  expect(profiles).toContain('md:hidden');
  expect(results).toContain('<summary class="cursor-pointer font-semibold text-slate-900">Cara IPS dan IPK dihitung</summary>');
});

test('shared list surfaces use restrained filters, action hierarchy, and skeleton modal loading', async () => {
  const [styles, master, catalog, profile] = await Promise.all([
    read('../app.css'),
    read('./components/MasterDataPage.svelte'),
    read('./components/CatalogPage.svelte'),
    read('./components/ProfilePage.svelte'),
  ]);

  expect(styles).toContain('.filter-panel');
  expect(styles).toContain('.action-primary');
  expect(master).toContain('class="filter-panel mt-6"');
  expect(catalog).toContain('class="filter-panel mt-6"');
  expect([master, catalog, profile].join('\n')).not.toContain('Memuat data');
  expect([master, catalog, profile].join('\n')).toContain('animate-pulse');
});
