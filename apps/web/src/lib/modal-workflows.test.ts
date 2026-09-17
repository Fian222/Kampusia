import { expect, test } from 'bun:test';
import { clearEditQueryHref, editQueryHref, modalNavigationOptions, resolveEditModalState } from './navigation/edit-modal';

const sourceRoot = `${import.meta.dir}/..`;
const read = (path: string) => Bun.file(`${sourceRoot}/${path}`).text();

test('shared modal provides native dialog accessibility and dismissal behavior', async () => {
  const modal = await read('lib/components/ui/Modal.svelte');
  expect(modal).toContain('<dialog');
  expect(modal).toContain('aria-label={title}');
  expect(modal).toContain('oncancel=');
  expect(modal).toContain('event.target === dialog');
  expect(modal).toContain("opener?.focus({ preventScroll: true })");
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
    expect(source, path).toContain("const queryEditId = $derived(page.url.searchParams.get('edit'))");
    expect(source, path).toContain('function openEdit(id: string) { requestedEditId = id; formOpen = true; }');
    expect(source, path).toContain('href={editQueryHref(page.url, row.id)} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => openEdit(row.id)}');
    expect(source, path).toMatch(/href=\{href\(\{ edit: (?:null|''), modal: 'create' \}\)\} data-sveltekit-noscroll data-sveltekit-keepfocus/);
    expect(source, path).toContain('editModal.loading');
    expect(source, path).toContain('value={data.edit?.id ?? \'\'}');
    expect(source, path).toContain('clearEditQueryHref(page.url)');
    expect(source, path).toContain('goto(clearEditQueryHref(page.url), { replaceState: true, ...modalNavigationOptions })');
    expect(source, path).not.toContain('data.edit?.id === row.id');
    expect(source, path).toContain("form?.values?.mode === 'save'");
    expect(source, path).toContain("result.type === 'success'");
  }
});

test('URL-backed modal navigation consistently preserves scroll and focus', async () => {
  expect(modalNavigationOptions).toEqual({ noScroll: true, keepFocus: true });

  const detail = await read('routes/(app)/akademik/kelas-kuliah/[id]/+page.svelte');
  expect(detail).toMatch(/href=\{`\/akademik\/kelas-kuliah\?edit=\$\{data\.kelas\.id\}`\} data-sveltekit-noscroll data-sveltekit-keepfocus/);
});

test('one edit click opens immediately and waits for the matching record before prefilling', () => {
  const clicked = resolveEditModalState({
    queryEditId: null,
    requestedEditId: 'dev-if',
    loadedEditId: null,
    createRequested: false,
    saveFailed: false,
  });
  expect(clicked).toEqual({ open: true, editing: true, editId: 'dev-if', loading: true });

  const loaded = resolveEditModalState({
    queryEditId: 'dev-if',
    requestedEditId: null,
    loadedEditId: 'dev-if',
    createRequested: false,
    saveFailed: false,
  });
  expect(loaded).toEqual({ open: true, editing: true, editId: 'dev-if', loading: false });
});

test('edit URLs change the target once and closing preserves unrelated list state', () => {
  const listUrl = new URL('https://kampusia.test/akademik/program-studi?status=AKTIF&page=2&search=if&modal=create');
  const editHref = editQueryHref(listUrl, 'dev-if');
  const editUrl = new URL(editHref, listUrl);

  expect(editHref).toBe('/akademik/program-studi?status=AKTIF&page=2&search=if&edit=dev-if');
  expect(editUrl.searchParams.getAll('edit')).toEqual(['dev-if']);
  expect(clearEditQueryHref(editUrl)).toBe('/akademik/program-studi?status=AKTIF&page=2&search=if');
});

test('URL-backed edit state switches records and follows browser history coherently', () => {
  const state = (queryEditId: string | null, loadedEditId: string | null) => resolveEditModalState({
    queryEditId,
    requestedEditId: null,
    loadedEditId,
    createRequested: false,
    saveFailed: false,
  });

  expect(state('faculty-a', 'faculty-a').loading).toBe(false);
  expect(state('faculty-b', 'faculty-a')).toEqual({ open: true, editing: true, editId: 'faculty-b', loading: true });
  expect(state('faculty-b', 'faculty-b').loading).toBe(false);
  expect(state(null, null).open).toBe(false);
  expect(state('faculty-a', 'faculty-a').editId).toBe('faculty-a');
});

test('failed edits retain their record while a successful edit resolves to closed state', () => {
  expect(resolveEditModalState({
    queryEditId: null,
    requestedEditId: null,
    loadedEditId: 'room-a',
    createRequested: false,
    saveFailed: true,
    failedEditId: 'room-a',
  })).toEqual({ open: true, editing: true, editId: 'room-a', loading: false });

  expect(resolveEditModalState({
    queryEditId: null,
    requestedEditId: null,
    loadedEditId: null,
    createRequested: false,
    saveFailed: false,
  })).toEqual({ open: false, editing: false, editId: null, loading: false });
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

  expect(curriculum).toContain('editingMembershipId = row.id; membershipOpen = true;');
  expect(detail).toContain('editingScheduleId = row.id; scheduleOpen = true;');
  expect(meetings).toContain('editingId = row.id; meetingOpen = true;');
  expect(grading).toContain('editingComponentId = component.id; componentOpen = true;');
  expect(grading).toContain('correctionComponentId = component.id; correctionOpen = true;');
});
