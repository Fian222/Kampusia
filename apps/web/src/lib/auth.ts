import type { Role } from 'api';

export const roleAreas = {
  ADMIN: { path: '/admin', label: 'Administrator', area: 'admin' },
  AKADEMIK: { path: '/akademik', label: 'Akademik', area: 'akademik' },
  DOSEN: { path: '/dosen', label: 'Dosen', area: 'dosen' },
  MAHASISWA: { path: '/mahasiswa', label: 'Mahasiswa', area: 'mahasiswa' },
} as const satisfies Record<Role, { path: string; label: string; area: string }>;
export const sessionCookie = 'kampusia_session';
export function isMasterDataPath(path: string) {
  return ['/akademik/fakultas', '/akademik/program-studi'].includes(path.replace(/\/$/, ''));
}
