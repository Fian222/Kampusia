<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  let { data } = $props();
  const profile = $derived(data.profile);
</script>

<svelte:head><title>Profil · Kampusia</title></svelte:head>

<PageHeader eyebrow="Akademik" title="Profil Mahasiswa" description="Data akademik Anda sebagaimana tercatat di bagian Akademik." />

<section class="surface-panel mt-6 p-5 sm:p-6" aria-labelledby="identity-title">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div><h2 id="identity-title" class="text-xl font-bold text-slate-950">{profile.nama}</h2><p class="mt-1 font-mono text-sm font-semibold text-slate-500">{profile.nim}</p></div>
    <Badge tone={profile.status === 'AKTIF' ? 'success' : profile.status === 'KELUAR' || profile.status === 'NONAKTIF' ? 'danger' : 'neutral'}>{profile.status}</Badge>
  </div>
  <dl class="mt-5 grid gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
    <div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Program studi</dt><dd class="mt-1 font-semibold text-slate-900">{profile.programStudi.nama}</dd><dd class="text-xs text-slate-500">{profile.programStudi.kode}</dd></div>
    <div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Fakultas</dt><dd class="mt-1 font-semibold text-slate-900">{profile.fakultas.nama}</dd></div>
    <div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Angkatan</dt><dd class="mt-1 font-semibold text-slate-900">{profile.angkatan}</dd></div>
    <div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Kurikulum</dt><dd class="mt-1 font-semibold text-slate-900">{profile.kurikulum.nama}</dd><dd class="text-xs text-slate-500">{profile.kurikulum.kode}</dd></div>
    <div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Dosen PA</dt><dd class="mt-1 font-semibold text-slate-900">{profile.dosenPa?.nama ?? 'Belum ditetapkan'}</dd>{#if profile.dosenPa}<dd class="text-xs text-slate-500">{profile.dosenPa.kodeDosen}</dd>{/if}</div>
  </dl>
</section>

<section class="surface-panel mt-4 p-5 sm:p-6" aria-labelledby="account-title">
  <h2 id="account-title" class="font-bold text-slate-950">Akun Login</h2>
  <dl class="mt-4 grid gap-4 text-sm sm:grid-cols-2">
    <div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor Induk</dt><dd class="mt-1 font-mono font-semibold text-slate-900">{profile.account?.loginId ?? profile.nim}</dd></div>
    <div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt><dd class="mt-1 text-slate-900">{profile.account?.email ?? 'Belum diisi'}</dd></div>
  </dl>
  <a class="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" href="/akun/password">Ganti kata sandi</a>
</section>

<p class="mt-4 flex items-start gap-2 text-sm text-slate-500"><Icon name="info" size={16} class="mt-0.5 shrink-0" /> Hubungi bagian Akademik bila ada data yang tidak sesuai.</p>
