import { expect, test } from 'bun:test';

const sourceRoot = `${import.meta.dir}/..`;
const read = (path: string) => Bun.file(`${sourceRoot}/${path}`).text();

test('shared modal provides native dialog accessibility and dismissal behavior', async () => {
  const modal = await read('lib/components/ui/Modal.svelte');
  expect(modal).toContain('<dialog');
  expect(modal).toContain('aria-label={title}');
  expect(modal).toContain('oncancel=');
  expect(modal).toContain('event.target === dialog');
  expect(modal).toContain("opener?.focus()");
  expect(modal).toContain("document.documentElement.style.overflow = 'hidden'");
  expect(modal).toContain('overflow-y-auto');
});

test('CRUD list pages open create and record-specific edit modals', async () => {
  const pages = [
    'lib/components/MasterDataPage.svelte',
    'lib/components/CatalogPage.svelte',
    'lib/components/ProfilePage.svelte',
    'routes/(app)/akademik/ruangan/+page.svelte',
    'routes/(app)/akademik/semester/+page.svelte',
    'routes/(app)/akademik/kelas-kuliah/+page.svelte',
  ];
  for (const path of pages) {
    const source = await read(path);
    expect(source, path).toContain('<Modal bind:open={formOpen}');
    expect(source, path).toMatch(/Tambah (?:\{title\}|Ruangan|Semester|Kelas)/);
    expect(source, path).toContain('data.edit?.id === row.id');
    expect(source, path).toContain("form?.values?.mode === 'save'");
    expect(source, path).toContain("result.type === 'success'");
  }
});

test('detail CRUD modals retain failed action and record context', async () => {
  const meetings = await read('lib/components/MeetingManager.svelte');
  expect(meetings).toContain("form?.values?.mode === 'meeting-save'");
  expect(meetings).toContain('form.values.pertemuan_id');
  expect(meetings).toContain('<form method="POST" {action}');

  const detail = await read('routes/(app)/akademik/kelas-kuliah/[id]/+page.svelte');
  expect(detail).toContain("form?.values?.mode === 'schedule-save'");
  expect(detail).toContain('form.values.jadwal_id');
  expect(detail).toContain('<ScheduleForm action="?/detail"');

  const grading = await read('lib/components/GradingManager.svelte');
  expect(grading).toContain("form?.values?.mode === 'component-update'");
  expect(grading).toContain('form.values.component_id');
  for (const form of grading.match(/<form\b[^>]*\bmethod="POST"[^>]*>/g) ?? []) {
    expect(form).toContain('action="?/grading"');
  }

  const curriculum = await read('routes/(app)/akademik/kurikulum/[id]/+page.svelte');
  expect(curriculum).toContain("form?.values?.mode === 'update'");
  expect(curriculum).toContain('form.values.membership_id');
});
