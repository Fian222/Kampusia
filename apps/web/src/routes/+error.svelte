<script lang="ts">
  import { page } from '$app/state';
  import Icon from '$lib/components/ui/Icon.svelte';
  const title = $derived(page.status === 403 ? 'Akses dibatasi' : page.status === 404 ? 'Halaman tidak ditemukan' : page.status === 400 ? 'Permintaan tidak valid' : 'Halaman belum dapat dimuat');
  const logoutFailed = $derived(page.url.pathname === '/logout');
</script>

<svelte:head><title>{title} · Kampusia</title></svelte:head>
<main class="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-5 py-12">
  <Icon name="alert" size={28} class="text-brand-700" />
  <h1 class="mt-4 text-2xl font-semibold text-ink">{title}</h1>
  <p role="alert" class="mt-3 text-base leading-7 text-muted">{logoutFailed ? 'Anda masih masuk. Layanan belum dapat mengakhiri sesi; coba keluar kembali.' : page.status >= 500 ? 'Layanan akademik sedang tidak tersedia. Silakan coba lagi dalam beberapa saat.' : page.error?.message ?? 'Periksa alamat halaman atau kembali ke ruang kerja.'}</p>
  <div class="mt-6 flex flex-wrap gap-3">
    {#if logoutFailed}<form method="POST" action="/logout"><button class="action-primary">Coba keluar kembali</button></form>
    {:else if page.status >= 500}<a class="action-primary" href={page.url.pathname + page.url.search} data-sveltekit-reload>Coba lagi</a>
    {:else if page.status === 400 && page.url.search}<a class="action-primary" href={page.url.pathname}>Hapus parameter halaman</a>{/if}
    <a class="action-secondary" href="/">Kembali ke ruang kerja</a>
  </div>
</main>
