import { expect, test } from 'bun:test';

const read = (path: string) => Bun.file(new URL(path, import.meta.url)).text();

test('Semester presents database dates and Jakarta instants with explicit formatters', async () => {
  const page = await read('../routes/(app)/akademik/semester/+page.svelte');

  expect(page).toContain('formatAcademicDate(row.tanggalMulai)');
  expect(page).toContain('formatAcademicDate(row.tanggalSelesai)');
  expect(page).toContain('formatJakartaDateTime(row.krsMulaiAt)');
  expect(page).toContain('formatJakartaDateTime(row.krsSelesaiAt)');
  expect(page).toContain('academicDateIso(data.edit.tanggalMulai)');
  expect(page).toContain('academicDateIso(data.edit.tanggalSelesai)');
  expect(page).not.toContain('{row.tanggalMulai}');
  expect(page).not.toContain('{row.tanggalSelesai}');
  expect(page).not.toMatch(/GMT[+-]\d{4}|Western Indonesia Time/);
});

test('Semester retains filters and actions in desktop and compact mobile layouts', async () => {
  const page = await read('../routes/(app)/akademik/semester/+page.svelte');

  expect(page).toContain('use:seamlessFilter');
  expect(page).toContain("const filterKeys = ['search', 'jenis', 'tahun_mulai', 'is_active']");
  expect(page).toContain('aria-labelledby="active-semester-title"');
  expect(page).toContain('hidden overflow-x-auto transition-opacity md:block');
  expect(page).toContain('md:hidden');
  expect(page).toContain('Edit Semester');
  expect(page).toContain('Atur Periode KRS');
  expect(page).toContain('Ya, aktifkan semester');
});

test('equivalent academic date surfaces use the shared calendar-date formatter', async () => {
  const [dashboard, meetings, attendanceRoster, studentAttendance] = await Promise.all([
    read('./components/Dashboard.svelte'),
    read('./components/MeetingManager.svelte'),
    read('./components/AttendanceRoster.svelte'),
    read('../routes/(app)/mahasiswa/absensi/+page.svelte'),
  ]);

  expect(dashboard).toContain('formatAcademicDateRange(semester.tanggalMulai, semester.tanggalSelesai)');
  expect(meetings).toContain('formatAcademicDate(row.tanggal)');
  expect(attendanceRoster).toContain('formatAcademicDate(roster.pertemuan.tanggal)');
  expect(studentAttendance).toContain('formatAcademicDate(row.pertemuan.tanggal)');
});
