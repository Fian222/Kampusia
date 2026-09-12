import { validateClassSchedules } from '../jadwal/jadwal.service';
import { MasterDataError } from '../../utils/master-data';
import { academicWrite } from '../../utils/academic-write';
import type { KelasDosenInput, KelasDosenQuery } from './kelas-dosen.model';
import type { KelasDosenRepository } from './kelas-dosen.repository';
export function createKelasDosenService(repository: KelasDosenRepository) {
  return {
    async list(id: string, query: KelasDosenQuery) {
      if (!await repository.findClass(id)) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
      return repository.list(id, query);
    },
    add(id: string, input: KelasDosenInput) {
      return academicWrite(() => repository.transaction(async tx => {
        const kelas = await tx.lockClass(id);
        if (!kelas) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
        const lecturer = await tx.lockDosen(input.dosen_id);
        if (!lecturer?.isActive) throw new MasterDataError(400, 'Dosen harus tersedia dan aktif untuk penugasan baru.');
        const rows = await tx.assignments(id);
        if (rows.some(row => row.dosenId === input.dosen_id)) throw new MasterDataError(409, 'Dosen sudah ditugaskan pada kelas ini.');
        if (input.is_koordinator && rows.some(row => row.isKoordinator)) throw new MasterDataError(409, 'Kelas hanya boleh memiliki satu koordinator. Lepaskan koordinator lama terlebih dahulu.');
        if (await tx.hasSchedule(id)) await validateClassSchedules(tx.scheduling, kelas, input.dosen_id);
        return tx.create(id, input.dosen_id, input.is_koordinator ?? false);
      }));
    },
    update(id: string, assignmentId: string, input: { is_koordinator: boolean }) {
      return academicWrite(() => repository.transaction(async tx => {
        if (!await tx.lockClass(id)) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
        const rows = await tx.assignments(id);
        if (!rows.some(row => row.id === assignmentId)) throw new MasterDataError(404, 'Penugasan dosen tidak ditemukan pada kelas ini.');
        if (input.is_koordinator && rows.some(row => row.id !== assignmentId && row.isKoordinator)) throw new MasterDataError(409, 'Kelas hanya boleh memiliki satu koordinator. Lepaskan koordinator lama terlebih dahulu.');
        return tx.update(assignmentId, input.is_koordinator);
      }));
    },
    remove(id: string, assignmentId: string) {
      return academicWrite(() => repository.transaction(async tx => {
        const kelas = await tx.lockClass(id);
        if (!kelas) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
        const rows = await tx.assignments(id);
        if (!rows.some(row => row.id === assignmentId)) throw new MasterDataError(404, 'Penugasan dosen tidak ditemukan pada kelas ini.');
        if (kelas.status === 'DIBUKA' && !rows.some(row => row.id !== assignmentId && row.dosen.isActive)) throw new MasterDataError(409, 'Kelas dibuka harus mempertahankan setidaknya satu dosen aktif.');
        // Removing an assignment releases lecturer time; student/room slots remain unchanged.
        await tx.remove(assignmentId);
        return { id: assignmentId };
      }));
    },
  };
}
export type KelasDosenService = ReturnType<typeof createKelasDosenService>;
