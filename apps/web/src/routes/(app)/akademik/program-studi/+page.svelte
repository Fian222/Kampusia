<script lang="ts">
  import MasterDataPage from '$lib/components/MasterDataPage.svelte';
  let { data, form } = $props();
</script>
<MasterDataPage {data} {form} />
