<script lang="ts">
  export type Field = { name: string; label: string; value?: string | number; type?: 'text' | 'number' | 'date' | 'time'; step?: string; min?: number; max?: number; maxlength?: number; options?: { value: string; label: string; disabled?: boolean }[] };
  let { fields, values = {} }: { fields: Field[]; values?: Record<string, string> } = $props();
</script>
{#each fields as field}
  <label class="text-sm font-medium">{field.label}
    {#if field.options}
      <select class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" name={field.name} required value={values[field.name] ?? field.value ?? ''}>
        <option value="" disabled>Pilih {field.label.toLowerCase()}</option>
        {#each field.options as option}<option value={option.value} disabled={option.disabled}>{option.label}</option>{/each}
      </select>
    {:else}
      <input class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" name={field.name} type={field.type ?? 'text'} step={field.step} min={field.min} max={field.max} maxlength={field.maxlength} required value={values[field.name] ?? field.value ?? ''} />
    {/if}
  </label>
{/each}
