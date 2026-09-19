<script lang="ts">
  import Dashboard from '$lib/components/Dashboard.svelte';
  let { data } = $props();
</script>

<Dashboard {data} />
