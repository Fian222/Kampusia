<script lang="ts">
  import ProfilePage from '$lib/components/ProfilePage.svelte';
  let { data, form } = $props();
</script>
<ProfilePage {data} {form} />
