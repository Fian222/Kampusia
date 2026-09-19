export const classWorkspaceTabs = [
  { id: 'overview', label: 'Ringkasan' },
  { id: 'lecturers', label: 'Dosen' },
  { id: 'schedule', label: 'Jadwal' },
  { id: 'meetings', label: 'Pertemuan' },
  { id: 'grading', label: 'Penilaian' },
  { id: 'settings', label: 'Pengaturan' },
] as const;

export type ClassWorkspaceTab = (typeof classWorkspaceTabs)[number]['id'];

export function resolveClassWorkspaceTab(value: string | null): ClassWorkspaceTab {
  return classWorkspaceTabs.some(tab => tab.id === value) ? value as ClassWorkspaceTab : 'overview';
}

export function classWorkspaceTabHref(url: URL, tab: ClassWorkspaceTab) {
  const params = new URLSearchParams(url.searchParams);
  params.set('tab', tab);
  return `${url.pathname}?${params}`;
}
