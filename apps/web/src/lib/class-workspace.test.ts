import { expect, test } from 'bun:test';
import { classWorkspaceTabHref, classWorkspaceTabs, resolveClassWorkspaceTab } from './navigation/class-workspace';

const sourceRoot = `${import.meta.dir}/..`;
const read = (path: string) => Bun.file(`${sourceRoot}/${path}`).text();

test('class workspace exposes the complete URL-backed navigation model', () => {
  expect(classWorkspaceTabs.map(tab => tab.id)).toEqual([
    'overview',
    'lecturers',
    'schedule',
    'meetings',
    'grading',
    'settings',
  ]);
  expect(resolveClassWorkspaceTab(null)).toBe('overview');
  expect(resolveClassWorkspaceTab('meetings')).toBe('meetings');
  expect(resolveClassWorkspaceTab('unknown')).toBe('overview');
});

test('tab links preserve route state and produce distinct browser-history URLs', () => {
  const current = new URL('https://kampusia.test/akademik/kelas-kuliah/kelas-a?tab=lecturers&page=2');
  const schedule = classWorkspaceTabHref(current, 'schedule');
  const meetings = classWorkspaceTabHref(new URL(schedule, current), 'meetings');

  expect(schedule).toBe('/akademik/kelas-kuliah/kelas-a?tab=schedule&page=2');
  expect(meetings).toBe('/akademik/kelas-kuliah/kelas-a?tab=meetings&page=2');
  expect(resolveClassWorkspaceTab(new URL(schedule, current).searchParams.get('tab'))).toBe('schedule');
  expect(resolveClassWorkspaceTab(current.searchParams.get('tab'))).toBe('lecturers');
});

test('Akademik class detail renders one focused workspace section with seamless links', async () => {
  const page = await read('routes/(app)/akademik/kelas-kuliah/[id]/+page.svelte');

  expect(page).toContain('classWorkspaceTabs');
  expect(page).toContain("activeTab === 'overview'");
  expect(page).toContain("activeTab === 'lecturers'");
  expect(page).toContain("activeTab === 'schedule'");
  expect(page).toContain("activeTab === 'meetings'");
  expect(page).toContain("activeTab === 'grading'");
  expect(page).toContain("activeTab === 'settings'");
  expect(page).toContain('data-sveltekit-noscroll');
  expect(page).toContain('aria-current={activeTab === tab.id ? \'page\' : undefined}');
  expect(page).toContain('Ringkasan kelas');
  expect(page).toContain('data.kelas.mataKuliah.nama');
  expect(page).toContain('data.kelas.semester.nama');
  expect(page).toContain('data.kelas.programStudi.nama');
  expect(page).toContain('Dosen Pengajar');
  expect(page).toContain('name="assignment_id"');
  expect(page).toContain('Jadwal Kuliah');
  expect(page).toContain('const regularSchedule = $derived(data.schedules.data[0])');
  expect(page).toContain('Atur Jadwal');
  expect(page).toContain('Edit Jadwal');
  expect(page).toContain('Belum ada jadwal untuk kelas ini.');
  expect(page).not.toContain('Tambah Jadwal');
  expect(page).not.toContain('scheduleHref');
  expect(page).not.toContain('<Pagination {...data.schedules.meta}');
  expect(page).toContain('name="jadwal_id"');
  expect(page).toContain('area="akademik"');
  expect(page).toContain('<GradingManager');
  expect(page).toContain('Status Kelas');
  expect(page).toContain('title="Ubah Status Kelas"');
  expect(page).toContain('Edit Kelas');
  expect(page).toContain('aria-label="Ringkasan metrik kelas"');
  expect(page).toContain('aria-label={`Tindakan lain untuk ${row.dosen.nama}`}');
  expect(page).not.toContain('class={box}');
  expect(page).not.toContain('href="#pertemuan"');
});

test('Dosen class detail remains teaching-focused without Akademik administration', async () => {
  const page = await read('routes/(app)/dosen/kelas-kuliah/[id]/+page.svelte');

  expect(page).toContain('area="dosen"');
  expect(page).not.toContain('classWorkspaceTabs');
  expect(page).not.toContain('Tambah Dosen');
  expect(page).not.toContain('Ubah Status');
  expect(page).not.toContain('Pengaturan');
  expect(page).toContain('href="#ringkasan"');
  expect(page).toContain('Pertemuan / Absensi');
  expect(page).toContain('data.grading.summary.completeStudents');
});

test('shared grading UI follows server permissions and keeps manager actions oversight-only', async () => {
  const component = await read('lib/components/GradingManager.svelte');
  const server = await read('lib/server/grading.ts');

  expect(component).toContain("area === 'akademik' ? 'Pengawasan Penilaian' : 'Penilaian'");
  expect(component).toContain('grading.permissions.canManageComponents');
  expect(component).toContain('grading.permissions.canRecordScores');
  expect(component).toContain('grading.permissions.canFinalize');
  expect(component).toContain('grading.permissions.canCorrect');
  expect(component).toContain('grading.finalization.message');
  expect(component).toContain('Koreksi administratif');
  expect(server).toContain("if (admin && values.mode !== 'correct')");
});
