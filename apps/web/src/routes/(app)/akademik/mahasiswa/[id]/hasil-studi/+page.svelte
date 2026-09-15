<script lang="ts">
  import AcademicResults from '$lib/components/AcademicResults.svelte';
  let { data } = $props();
</script>

<AcademicResults {data} />
