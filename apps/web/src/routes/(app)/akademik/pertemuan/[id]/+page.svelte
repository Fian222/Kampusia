<script lang="ts">import AttendanceRoster from '$lib/components/AttendanceRoster.svelte'; let { data, form } = $props();</script>
<a class="text-teal-800" href={`/akademik/kelas-kuliah/${data.roster.pertemuan.kelasKuliahId}`}>← Kelas Kuliah</a>
<AttendanceRoster roster={data.roster} area="akademik" {form} />
