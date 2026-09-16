<script lang="ts">
  export type Field = { name: string; label: string; value?: string | number; type?: 'text' | 'number' | 'date' | 'time'; step?: string; min?: number; max?: number; maxlength?: number; options?: { value: string; label: string; disabled?: boolean }[] };
  let { fields, values = {} }: { fields: Field[]; values?: Record<string, string> } = $props();
</script>
{#each fields as field}
  <label class="text-sm font-semibold text-slate-700">{field.label}<span class="ml-1 text-red-500" aria-hidden="true">*</span>
    {#if field.options}
      <select class="control-base mt-1.5" name={field.name} required value={values[field.name] ?? field.value ?? ''}>
        <option value="" disabled>Pilih {field.label.toLowerCase()}</option>
        {#each field.options as option}<option value={option.value} disabled={option.disabled}>{option.label}</option>{/each}
      </select>
    {:else}
      <input class="control-base mt-1.5" name={field.name} type={field.type ?? 'text'} step={field.step} min={field.min} max={field.max} maxlength={field.maxlength} required value={values[field.name] ?? field.value ?? ''} />
    {/if}
  </label>
{/each}
