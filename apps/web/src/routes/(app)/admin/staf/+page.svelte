<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { page, navigating } from '$app/state';
  import { seamlessFilter } from '$lib/actions/seamless-filter';
  import { isListNavigationPending } from '$lib/navigation/pending';
  import { hasActiveQuery, resetQueryHref } from '$lib/navigation/query';
  import Pagination from '$lib/components/Pagination.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import TemporaryCredentialModal from '$lib/components/TemporaryCredentialModal.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import SelectField from '$lib/components/ui/SelectField.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import ListPending from '$lib/components/ui/ListPending.svelte';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { PageProps } from './$types';

  type Account = PageProps['data']['records']['data'][number];
  type Credential = { account: { loginId: string | null }; temporaryPassword: string };
  let { data, form }: PageProps = $props();
  let saving = $state(false);
  let formOpen = $state(false);
  let editing = $state<Account | null>(null);
  let confirmation = $state<{ mode: 'status' | 'reset-password'; account: Account } | null>(null);
  let confirmationOpen = $state(false);
  let credential = $state<Credential | null>(null);
  let credentialTitle = $state('');
  let credentialOpen = $state(false);
  const listPending = $derived(isListNavigationPending(navigating, page.url.pathname));
  const filterKeys = ['search', 'role', 'is_active'];
  const filtersActive = $derived(hasActiveQuery(page.url, filterKeys));
  const formError = $derived(form && 'message' in form && !('saved' in form) && ['create', 'update'].includes(form.values?.mode ?? '') ? form.message : null);
  const confirmationError = $derived(form && 'message' in form && !('saved' in form) && ['status', 'reset-password'].includes(form.values?.mode ?? '') ? form.message : null);
  const roleOptions = $derived(data.roles.map(role => ({ value: role, label: role })));
  const button = 'min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50';

  function href(number: number) { const params = new URLSearchParams(page.url.searchParams); params.set('page', String(number)); return '?' + params; }
  function openForm(account: Account | null) { editing = account; formOpen = true; }
  function confirm(mode: 'status' | 'reset-password', account: Account) { confirmation = { mode, account }; confirmationOpen = true; }

  const submit = (close: () => void): SubmitFunction => () => {
    saving = true;
    return async ({ result, update }) => {
      try {
        if (result.type === 'success' && result.data && 'accountCredential' in result.data) {
          credential = result.data.accountCredential as Credential;
          credentialTitle = result.data.mode === 'reset-password' ? 'Password berhasil direset' : 'Akun staf berhasil dibuat';
          close();
          credentialOpen = true;
          await invalidateAll();
        } else {
          await update({ reset: false });
          if (result.type === 'success') close();
        }
      } finally { saving = false; }
    };
  };
</script>

<svelte:head><title>Akun Staf · Kampusia</title></svelte:head>

<PageHeader eyebrow="Administrasi" title="Akun Staf" description="Kelola akun login ADMIN dan AKADEMIK. Akun mahasiswa dan dosen dibuat dari profil masing-masing.">
  {#snippet actions()}<button type="button" class="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800" onclick={() => openForm(null)}><Icon name="plus" size={16} /> Tambah Akun Staf</button>{/snippet}
</PageHeader>

{#if form && 'saved' in form}<p role="status" class="mt-6 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">{form.message}</p>{/if}

<form method="GET" class="filter-panel mt-6 grid gap-4 sm:grid-cols-3" use:seamlessFilter>
  <label class="text-sm font-semibold text-slate-700">Cari NIK atau email<input class="control-base mt-1.5" name="search" value={data.filters.search} maxlength="150" /></label>
  <SelectField name="role" label="Peran" value={data.filters.role ?? ''} options={[{ value: '', label: 'Semua peran' }, ...roleOptions]} />
  <SelectField name="is_active" label="Status" value={data.filters.is_active ?? ''} options={[{ value: '', label: 'Semua status' }, { value: 'true', label: 'Aktif' }, { value: 'false', label: 'Nonaktif' }]} />
  <noscript><button class={button}>Terapkan filter</button></noscript>
  {#if filtersActive}<div class="flex items-end"><a class="py-2 text-sm text-slate-600" href={resetQueryHref(page.url, filterKeys)} data-sveltekit-noscroll>Reset filter</a></div>{/if}
</form>

<section class="table-shell relative mt-6 overflow-x-auto" aria-label="Daftar akun staf" aria-busy={listPending}>
  <ListPending />
  <table class="w-full min-w-[760px] text-left text-sm transition-opacity" class:opacity-80={listPending}>
    <thead><tr><th class="p-4">Nomor Induk (NIK)</th><th class="p-4">Email</th><th class="p-4">Peran</th><th class="p-4">Status</th><th class="p-4">Tindakan</th></tr></thead>
    <tbody class="divide-y divide-slate-100">
      {#each data.records.data as row (row.loginId)}
        {@const self = row.loginId === data.currentLoginId}
        <tr>
          <td class="p-4"><span class="font-mono font-semibold text-slate-900">{row.loginId}</span>{#if self}<span class="ml-2 text-xs text-slate-500">(akun Anda)</span>{/if}</td>
          <td class="p-4">{row.email ?? '—'}</td>
          <td class="p-4"><Badge tone={row.role === 'ADMIN' ? 'info' : 'neutral'}>{row.role}</Badge></td>
          <td class="p-4"><StatusBadge active={row.isActive} />{#if row.mustChangePassword}<p class="mt-1 text-xs text-amber-700">Wajib ganti password</p>{/if}</td>
          <td class="p-4">
            <div class="flex flex-wrap gap-2 whitespace-nowrap">
              <button type="button" class="action-secondary" aria-label={`Edit akun ${row.loginId}`} onclick={() => openForm(row)}>Edit</button>
              {#if !self}
                <button type="button" class="action-ghost" onclick={() => confirm('status', row)}>{row.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button type="button" class="action-ghost" onclick={() => confirm('reset-password', row)}>Reset Password</button>
              {/if}
            </div>
          </td>
        </tr>
      {:else}<tr><td colspan="5" class="p-8 text-center text-slate-500">{filtersActive ? 'Tidak ada akun staf sesuai filter.' : 'Belum ada akun staf.'}</td></tr>{/each}
    </tbody>
  </table>
</section>
<Pagination {...data.records.meta} {href} />

<Modal bind:open={formOpen} title={editing ? `Edit Akun ${editing.loginId}` : 'Tambah Akun Staf'} description={editing ? 'Nomor Induk tidak dapat diubah. Untuk koreksi NIK, nonaktifkan akun ini dan buat akun baru.' : 'Password sementara dibuat otomatis dan wajib diganti saat login pertama.'} closeDisabled={saving} width="md" onClose={() => editing = null}>
  {#if formError}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</p>{/if}
  {#key `${editing?.loginId ?? 'new'}:${JSON.stringify(form)}`}
    <form method="POST" class="grid gap-4" use:enhance={submit(() => formOpen = false)}>
      <input type="hidden" name="mode" value={editing ? 'update' : 'create'} />
      {#if editing}<input type="hidden" name="login_id" value={editing.loginId} />
      {:else}<label class="text-sm font-semibold text-slate-700">NIK staf<span class="ml-1 text-red-500" aria-hidden="true">*</span><input class="control-base mt-1.5" name="login_id" inputmode="numeric" pattern="[0-9]+" maxlength="30" required value={form?.values?.mode === 'create' ? form.values.login_id : ''} /></label>{/if}
      <SelectField name="role" label="Peran" required value={form?.values?.mode === (editing ? 'update' : 'create') ? form.values.role : editing?.role ?? 'AKADEMIK'} options={roleOptions} help={editing?.loginId === data.currentLoginId ? 'Peran akun Anda sendiri tidak dapat diturunkan.' : undefined} />
      <label class="text-sm font-semibold text-slate-700">Email (opsional)<input class="control-base mt-1.5" name="email" type="email" maxlength="254" value={form?.values?.mode === (editing ? 'update' : 'create') ? form.values.email : editing?.email ?? ''} /></label>
      <div class="flex justify-end gap-3"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => formOpen = false}>Batal</button><button class={button} disabled={saving}>{saving ? 'Menyimpan…' : editing ? 'Simpan' : 'Buat Akun'}</button></div>
    </form>
  {/key}
</Modal>

<Modal bind:open={confirmationOpen} title={confirmation?.mode === 'reset-password' ? 'Reset Password' : confirmation?.account.isActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun'} description={confirmation ? `Akun ${confirmation.account.loginId} (${confirmation.account.role})` : undefined} closeDisabled={saving} width="sm" onClose={() => confirmation = null}>
  {#if confirmation}
    <p class="text-sm leading-6 text-slate-600">{confirmation.mode === 'reset-password' ? 'Password saat ini tidak lagi dapat digunakan dan sesi aktif akun ini berakhir. Password sementara baru akan dibuat.' : confirmation.account.isActive ? 'Akun tidak dapat login dan sesi aktifnya berakhir. Riwayat tindakan tetap tersimpan.' : 'Akun dapat login kembali dengan password terakhirnya.'}</p>
    {#if confirmationError}<p role="alert" class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{confirmationError}</p>{/if}
    <form method="POST" class="mt-5 flex justify-end gap-3" use:enhance={submit(() => confirmationOpen = false)}>
      <input type="hidden" name="mode" value={confirmation.mode} /><input type="hidden" name="login_id" value={confirmation.account.loginId} /><input type="hidden" name="is_active" value={String(!confirmation.account.isActive)} />
      <button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => confirmationOpen = false}>Batal</button>
      <button class={button} disabled={saving}>{saving ? 'Memproses…' : 'Ya, lanjutkan'}</button>
    </form>
  {/if}
</Modal>

<TemporaryCredentialModal bind:open={credentialOpen} title={credentialTitle} {credential} onClose={() => { credential = null; }} />
