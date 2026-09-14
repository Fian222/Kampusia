<script lang="ts">import AttendanceRoster from '$lib/components/AttendanceRoster.svelte'; let { data, form } = $props();</script>
<a class="text-teal-800" href={`/dosen/kelas-kuliah/${data.roster.pertemuan.kelasKuliahId}`}>← Kelas</a>
<AttendanceRoster roster={data.roster} area="dosen" {form} />
