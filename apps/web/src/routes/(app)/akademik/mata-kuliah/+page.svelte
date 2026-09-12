<script lang="ts">
  import CatalogPage from '$lib/components/CatalogPage.svelte';
  let { data, form } = $props();
</script>
<CatalogPage {data} {form} />
