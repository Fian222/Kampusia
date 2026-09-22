import { expect, test } from 'bun:test';

const read = (path: string) => Bun.file(new URL(path, import.meta.url)).text();

test('reference combobox submits ids and supports scalable keyboard search', async () => {
  const source = await read('./components/ReferenceCombobox.svelte');

  expect(source).toContain('onDestroy(() => globalThis.clearTimeout(debounceTimer))');
  expect(source).not.toContain('onDestroy(() => window.clearTimeout(debounceTimer))');
  expect(source).toContain('<input type="hidden" {name} {value}');
  expect(source).toContain('value = option.value');
  expect(source).toContain('window.setTimeout(() => navigate');
  expect(source).toContain("event.key === 'ArrowDown'");
  expect(source).toContain("event.key === 'ArrowUp'");
  expect(source).toContain("event.key === 'Enter'");
  expect(source).toContain("event.key === 'Escape'");
  expect(source).toContain('role="combobox"');
  expect(source).toContain('role="listbox"');
  expect(source).toContain('role="option"');
  expect(source).toContain('aria-selected={option.value === value}');
  expect(source).toContain('Muat lebih banyak');
  expect(source).toContain('Kosongkan ${label}');
  expect(source).not.toContain('<Pagination');
  expect(source).not.toContain('Menampilkan');
  expect(source).not.toContain('Sebelumnya');
  expect(source).not.toContain('Berikutnya');
});

test('mahasiswa references preserve edit labels and reset incompatible curriculum', async () => {
  const [profile, loader] = await Promise.all([
    read('./components/ProfilePage.svelte'),
    read('./server/academic-profiles.ts'),
  ]);

  expect(profile).toContain('selectedOption={selectedProgramOption}');
  expect(profile).toContain('selectedOption={selectedCurriculumOption}');
  expect(profile).toContain('selectedOption={selectedAdviserOption}');
  expect(profile).toContain("selectedCurriculumId = ''");
  expect(profile).toContain('choice_program: programId || null');
  expect(profile).toContain('bind:value={selectedProgramId}');
  expect(profile).toContain('bind:value={selectedCurriculumId}');
  expect(profile).toContain('bind:value={selectedAdviserId}');
  expect(profile).toContain('nullable help="Wajib sebelum mahasiswa mengajukan KRS."');
  expect(profile).toContain("form?.values?.program_studi_id");
  expect(profile).not.toContain('Cari Program Studi');
  expect(profile).not.toContain('Cari Kurikulum');
  expect(profile).not.toContain('Cari Dosen PA aktif');
  expect(loader).toContain('program_studi_id: curriculumQuery.program_studi_id ?? edit?.data.programStudiId');
});

test('entity relationship forms use the shared compact control', async () => {
  const sources = await Promise.all([
    read('./components/MasterDataPage.svelte'),
    read('./components/CatalogPage.svelte'),
    read('../routes/(app)/akademik/kelas-kuliah/+page.svelte'),
    read('../routes/(app)/akademik/kelas-kuliah/[id]/+page.svelte'),
    read('../routes/(app)/akademik/kurikulum/[id]/+page.svelte'),
    read('./components/ScheduleForm.svelte'),
  ]);
  const joined = sources.join('\n');

  for (const name of ['fakultas_id', 'program_studi_id', 'semester_id', 'mata_kuliah_id', 'dosen_id', 'ruangan_id']) {
    expect(joined).toContain(`ReferenceCombobox name="${name}"`);
  }
  expect(joined).not.toContain('<AcademicOptions');
  expect(joined).not.toContain('Cari Mata Kuliah Aktif');
  expect(joined).not.toContain('Cari pilihan mata kuliah');
});
