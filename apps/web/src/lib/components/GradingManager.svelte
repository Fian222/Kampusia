<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Badge from './ui/Badge.svelte';
  import Icon from './ui/Icon.svelte';
  import Modal from './ui/Modal.svelte';
  let { grading, area, form } = $props();
  let saving = $state(false);
  let componentOpen = $state(false);
  let editingComponentId = $state<string>();
  let correctionOpen = $state(false);
  let correctionStudentId = $state<string>();
  let correctionComponentId = $state<string>();
  const button = 'min-h-9 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white shadow-sm hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50';
  const input = 'control-base';
  const submit = () => { saving = true; return async ({ update }: { update: (options: { reset: boolean; invalidateAll: boolean }) => Promise<void> }) => { try { await update({ reset: true, invalidateAll: true }); } finally { saving = false; } }; };
  const scoreFor = (row: typeof grading.data[number], componentId: string) => row.scores.find((score: { componentId: string; nilai: string | null }) => score.componentId === componentId)?.nilai ?? null;
  const editingComponent = $derived(grading.components.find((item: { id: string }) => item.id === editingComponentId));
  const correctionStudent = $derived(grading.data.find((item: { mahasiswa: { id: string } }) => item.mahasiswa.id === correctionStudentId));
  const correctionComponent = $derived(grading.components.find((item: { id: string }) => item.id === correctionComponentId));
  const componentValues = $derived(form?.values && ['component-create', 'component-update'].includes(form.values.mode ?? '') && (form.values.component_id ?? '') === (editingComponentId ?? '') ? form.values : undefined);
  const correctionValues = $derived(form?.values?.mode === 'correct' && form.values.mahasiswa_id === correctionStudentId && form.values.component_id === correctionComponentId ? form.values : undefined);
  const gradingModes = ['component-create', 'component-update', 'component-delete', 'score-save', 'finalize', 'correct'];
  const gradingFeedback = $derived(form?.values?.mode && gradingModes.includes(form.values.mode) ? form : undefined);
  const modalSubmit = (kind: 'component' | 'correction') => { saving = true; return async ({ update, result }: { update: (options: { reset: boolean; invalidateAll: boolean }) => Promise<void>; result: { type: string } }) => { try { await update({ reset: false, invalidateAll: true }); if (result.type === 'success') { if (kind === 'component') componentOpen = false; else correctionOpen = false; } } finally { saving = false; } }; };
  $effect(() => {
    if (form?.values?.mode === 'component-create' && !form.saved) { editingComponentId = undefined; componentOpen = true; }
    if (form?.values?.mode === 'component-update' && !form.saved) { editingComponentId = form.values.component_id; componentOpen = true; }
    if (form?.values?.mode === 'correct' && !form.saved) { correctionStudentId = form.values.mahasiswa_id; correctionComponentId = form.values.component_id; correctionOpen = true; }
  });
</script>

<section class="surface-panel mt-6 overflow-hidden">
  <div class="p-5 sm:p-6">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div><p class="eyebrow">Evaluasi pembelajaran</p><h2 class="mt-2 text-xl font-bold">Penilaian</h2><p class="mt-1 text-sm leading-6 text-slate-500">Nilai kosong berarti belum dinilai; <strong class="font-semibold text-slate-700">0.00 tetap merupakan nilai sah</strong>.</p></div>
    <div class="flex flex-wrap gap-2"><div class="rounded-xl bg-slate-100 px-4 py-2.5 text-sm"><span class="block text-xs text-slate-500">Bobot aktif</span><strong class="text-slate-900">{grading.summary.activeWeight}%</strong></div><div class="rounded-xl bg-brand-50 px-4 py-2.5 text-sm"><span class="block text-xs text-brand-700">Nilai lengkap</span><strong class="text-brand-900">{grading.summary.completeStudents}/{grading.summary.totalStudents}</strong></div></div>
  </div>
  {#if gradingFeedback?.message}<p class="mt-4 rounded-lg border p-3 text-sm" class:border-brand-200={gradingFeedback.saved} class:bg-brand-50={gradingFeedback.saved} class:border-red-200={!gradingFeedback.saved} class:bg-red-50={!gradingFeedback.saved} role={gradingFeedback.saved ? 'status' : 'alert'}>{gradingFeedback.message}</p>{/if}
  {#if saving}<p class="mt-3 text-sm" role="status">Menyimpan…</p>{/if}
  {#if grading.summary.finalized}<div class="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-6 text-amber-900"><Icon name="alert" size={18} class="mt-0.5 shrink-0" /><p><strong>Nilai telah difinalisasi.</strong> Konfigurasi dan penyuntingan biasa dibekukan; hasil resmi hanya dapat diubah lewat koreksi terkontrol ADMIN/AKADEMIK.</p></div>{/if}

  <div class="mt-7 flex items-center justify-between gap-3"><h3 class="font-bold text-slate-900">Komponen nilai</h3>{#if !grading.summary.finalized}<button type="button" class={button} onclick={() => { editingComponentId = undefined; componentOpen = true; }}><span class="inline-flex items-center gap-1.5"><Icon name="plus" size={14} /> Tambah komponen</span></button>{/if}</div>
  <div class="mt-3 overflow-x-auto rounded-xl border border-slate-200"><table class="w-full text-left text-sm"><thead><tr><th class="p-3">Urutan</th><th class="p-3">Nama</th><th class="p-3">Bobot</th><th class="p-3">Status</th><th class="p-3">Tindakan</th></tr></thead>
    <tbody class="divide-y divide-slate-100">{#each grading.components as component}<tr><td class="p-3">{component.urutan}</td><td class="p-3 font-semibold text-slate-900">{component.nama}</td><td class="p-3">{component.bobot}%</td><td class="p-3"><Badge tone={component.isActive ? 'success' : 'neutral'}>{component.isActive ? 'Aktif' : 'Nonaktif'}</Badge></td><td class="p-3">
      {#if !grading.summary.finalized}<div class="flex items-start gap-3"><button type="button" class="text-teal-800" aria-label={`Edit komponen ${component.nama}`} onclick={() => { editingComponentId = component.id; componentOpen = true; }}>Edit</button><details><summary class="cursor-pointer text-red-700">Hapus</summary><form method="POST" action="?/grading" class="mt-3 min-w-64" use:enhance={submit}><input type="hidden" name="mode" value="component-delete" /><input type="hidden" name="component_id" value={component.id} /><label class="block text-xs"><input type="checkbox" name="confirm" value="yes" required /> Hapus hanya jika belum pernah memiliki nilai</label><button class="mt-2 text-sm text-red-700" disabled={saving}>Hapus komponen</button></form></details></div>{:else}—{/if}
    </td></tr>{:else}<tr><td colspan="5" class="p-6 text-center text-slate-500">Belum ada komponen nilai.</td></tr>{/each}</tbody>
  </table></div>

  <div class="mt-8 flex flex-wrap items-end justify-between gap-3"><div><h3 class="font-bold text-slate-900">Daftar nilai mahasiswa</h3><p class="mt-1 text-sm text-slate-500">Geser tabel secara horizontal untuk melihat seluruh komponen.</p></div>{#if grading.summary.finalized}<Badge tone="success"><Icon name="check" size={13} /> Final</Badge>{:else}<Badge tone={grading.summary.missingScores > 0 ? 'warning' : 'success'}>{grading.summary.missingScores} nilai belum diisi</Badge>{/if}</div>
  <div class="mt-3 max-h-[70vh] overflow-auto rounded-xl border border-slate-200"><table class="min-w-full text-left text-sm"><thead class="sticky top-0 z-20"><tr><th class="sticky left-0 z-30 min-w-56 border-r border-slate-200 bg-slate-50 p-3">NIM / Nama</th>{#each grading.components.filter((item: { isActive: boolean }) => item.isActive) as component}<th class="min-w-48 p-3">{component.nama}<br /><span class="font-normal normal-case tracking-normal">Bobot {component.bobot}%</span></th>{/each}<th class="min-w-40 p-3">Nilai akhir</th></tr></thead>
    <tbody class="divide-y divide-slate-100">{#each grading.data as row}<tr class="group align-top"><td class="sticky left-0 z-10 border-r border-slate-100 bg-white p-3 group-hover:bg-slate-50"><span class="font-semibold text-slate-900">{row.mahasiswa.nim}</span><br /><span class="text-slate-600">{row.mahasiswa.nama}</span></td>{#each grading.components.filter((item: { isActive: boolean }) => item.isActive) as component}{@const current = scoreFor(row, component.id)}<td class="p-3">
      {#if !grading.summary.finalized}<form method="POST" action="?/grading" class="flex gap-2" use:enhance={submit}><input type="hidden" name="mode" value="score-save" /><input type="hidden" name="mahasiswa_id" value={row.mahasiswa.id} /><input type="hidden" name="component_id" value={component.id} /><input class={`${input} min-w-28 font-mono`} class:border-amber-400={current === null} class:bg-amber-50={current === null} name="nilai" value={current ?? ''} inputmode="decimal" placeholder="Belum dinilai" aria-label={`Nilai ${component.nama} ${row.mahasiswa.nama}`} /><button class={button} disabled={saving}>Simpan</button></form>{:else}<span class:font-semibold={current === '0.00'} class:text-slate-400={current === null}>{current ?? 'Belum dinilai'}</span>
        {#if area === 'akademik'}<button type="button" class="mt-2 block text-xs text-amber-800" aria-label={`Koreksi ${component.nama} ${row.mahasiswa.nama}`} onclick={() => { correctionStudentId = row.mahasiswa.id; correctionComponentId = component.id; correctionOpen = true; }}>Koreksi</button>{/if}
      {/if}
    </td>{/each}<td class="p-3">{#if row.hasilStudi}<span class="font-semibold">{row.hasilStudi.nilaiAngka} ({row.hasilStudi.nilaiHuruf} / {row.hasilStudi.nilaiIndeks})</span>{#if row.hasilStudi.dikoreksiAt}<br /><span class="text-xs text-amber-800">Dikoreksi: {row.hasilStudi.alasanKoreksi}</span>{/if}{:else}{row.preview ?? 'Belum lengkap'}{/if}</td></tr>{:else}<tr><td colspan={grading.components.length + 2} class="p-8 text-center text-slate-500">Tidak ada mahasiswa dengan KRS DISETUJUI dan pilihan AKTIF.</td></tr>{/each}</tbody>
  </table></div>
  {#if !grading.summary.finalized}<div class="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><p class="text-sm leading-6 text-amber-900">Finalisasi bersifat atomik dan membekukan konfigurasi serta penyuntingan biasa. Kelas harus DITUTUP, bobot harus 100.00%, dan seluruh nilai harus lengkap.</p><form method="POST" action="?/grading" class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" use:enhance={submit}><input type="hidden" name="mode" value="finalize" /><label class="flex items-start gap-2 text-sm"><input class="mt-0.5" type="checkbox" name="confirm" value="yes" required /> Saya memahami dan mengonfirmasi finalisasi</label><button class={button} disabled={saving || grading.kelas.status !== 'DITUTUP' || grading.summary.activeWeight !== '100.00' || grading.summary.missingScores > 0 || grading.summary.totalStudents === 0}>Finalisasi nilai kelas</button></form></div>{/if}
  </div>
</section>

<Modal bind:open={componentOpen} title={`${editingComponent ? 'Edit' : 'Tambah'} Komponen Nilai`} description="Total bobot komponen aktif harus mencapai 100% sebelum finalisasi." closeDisabled={saving} width="md" onClose={() => { if (componentValues) void goto(page.url, { replaceState: true, noScroll: true, keepFocus: true }); }}>
  {#if form?.message && componentValues}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  <form method="POST" action="?/grading" class="grid gap-4 sm:grid-cols-2" use:enhance={() => modalSubmit('component')}>
    <input type="hidden" name="mode" value={editingComponent ? 'component-update' : 'component-create'} /><input type="hidden" name="component_id" value={editingComponent?.id ?? ''} />
    <label class="text-sm sm:col-span-2">Nama<input class={`${input} mt-1.5`} name="nama" value={componentValues?.nama ?? editingComponent?.nama ?? ''} required maxlength="100" /></label>
    <label class="text-sm">Bobot (%)<input class={`${input} mt-1.5`} name="bobot" value={componentValues?.bobot ?? editingComponent?.bobot ?? ''} required inputmode="decimal" placeholder="20.00" /></label>
    <label class="text-sm">Urutan<input class={`${input} mt-1.5`} name="urutan" type="number" min="1" max="32767" value={componentValues?.urutan ?? editingComponent?.urutan ?? ''} required /></label>
    {#if editingComponent}<label class="text-sm sm:col-span-2">Status<select class={`${input} mt-1.5`} name="is_active" value={componentValues?.is_active ?? String(editingComponent.isActive)}><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>{/if}
    <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => componentOpen = false}>Batal</button><button class={button} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan komponen'}</button></div>
  </form>
</Modal>

<Modal bind:open={correctionOpen} title="Koreksi Nilai Resmi" description={correctionStudent && correctionComponent ? `${correctionStudent.mahasiswa.nama} · ${correctionComponent.nama}` : undefined} closeDisabled={saving} width="md" onClose={() => { if (correctionValues) void goto(page.url, { replaceState: true, noScroll: true, keepFocus: true }); }}>
  {#if form?.message && correctionValues}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  {#if correctionStudent && correctionComponent}
    <form method="POST" action="?/grading" class="grid gap-4" use:enhance={() => modalSubmit('correction')}><input type="hidden" name="mode" value="correct" /><input type="hidden" name="mahasiswa_id" value={correctionStudent.mahasiswa.id} /><input type="hidden" name="component_id" value={correctionComponent.id} />
      <label class="text-sm">Nilai<input class={`${input} mt-1.5`} name="nilai" value={correctionValues?.nilai ?? scoreFor(correctionStudent, correctionComponent.id) ?? ''} required inputmode="decimal" /></label><label class="text-sm">Alasan koreksi<textarea class={`${input} mt-1.5`} name="alasan" required placeholder="Jelaskan alasan koreksi">{correctionValues?.alasan ?? ''}</textarea></label><label class="text-xs"><input type="checkbox" name="confirm" value="yes" required /> Konfirmasi perubahan nilai resmi</label><div class="flex justify-end gap-3"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => correctionOpen = false}>Batal</button><button class={button} disabled={saving}>Koreksi dan hitung ulang</button></div>
    </form>
  {/if}
</Modal>
