import { expect, test } from 'bun:test';

const sourceRoot = `${import.meta.dir}/..`;
const read = (path: string) => Bun.file(`${sourceRoot}/${path}`).text();

test('Akademik class workspace exposes meeting management and attendance oversight', async () => {
  const [page, server, meetings] = await Promise.all([
    read('routes/(app)/akademik/kelas-kuliah/[id]/+page.svelte'),
    read('routes/(app)/akademik/kelas-kuliah/[id]/+page.server.ts'),
    read('lib/components/MeetingManager.svelte'),
  ]);

  expect(page).toContain('area="akademik"');
  expect(server).toContain('meeting: event => saveMeeting(event)');
  expect(meetings).toContain('Buka Pertemuan');
  expect(meetings).toContain("area === 'akademik' && row.status !== 'DIBATALKAN'");
  expect(meetings).toContain('Awasi Absensi');
});

test('Dosen class workspace has attendance actions and no meeting mutation action', async () => {
  const [page, server, meetings] = await Promise.all([
    read('routes/(app)/dosen/kelas-kuliah/[id]/+page.svelte'),
    read('routes/(app)/dosen/kelas-kuliah/[id]/+page.server.ts'),
    read('lib/components/MeetingManager.svelte'),
  ]);

  expect(page).toContain('area="dosen"');
  expect(server).not.toContain('saveMeeting');
  expect(server).not.toContain('meeting:');
  expect(meetings).toContain("if (recorded === 0) return 'Isi Absensi'");
  expect(meetings).toContain("if (recorded < total) return 'Lanjutkan Absensi'");
  expect(meetings).toContain("if (status === 'SELESAI') return 'Lihat Absensi'");
  expect(meetings).toContain('row.attendanceProgress.recorded');
});

test('completed Dosen attendance is visibly read-only while Akademik correction remains available', async () => {
  const roster = await read('lib/components/AttendanceRoster.svelte');

  expect(roster).toContain("roster.pertemuan.status === 'SELESAI' && area === 'dosen'");
  expect(roster).toContain('Mode baca saja; koreksi pasca-selesai dilakukan oleh Akademik.');
  expect(roster).toContain('{#if readOnly}');
  expect(roster).toContain('Selesaikan Absensi');
  expect(roster).toContain("roster.pertemuan.status === 'SELESAI' && area === 'akademik'");
});
