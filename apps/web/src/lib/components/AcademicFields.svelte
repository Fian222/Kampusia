<script lang="ts">
  import SelectField from './ui/SelectField.svelte';
  export type Field = { name: string; label: string; value?: string | number; type?: 'text' | 'number' | 'date' | 'time' | 'datetime-local'; required?: boolean; step?: string; min?: number; max?: number; maxlength?: number; options?: { value: string; label: string; disabled?: boolean }[] };
  let { fields, values = {} }: { fields: Field[]; values?: Record<string, string> } = $props();
</script>
{#each fields as field}
  {#if field.options}
    <SelectField name={field.name} label={field.label} required={field.required ?? true} value={String(values[field.name] ?? field.value ?? '')} options={field.options} placeholder={`Pilih ${field.label.toLowerCase()}`} />
  {:else}
    <label class="text-sm font-semibold text-slate-700">{field.label}{#if field.required ?? true}<span class="ml-1 text-red-500" aria-hidden="true">*</span>{/if}
      <input class="control-base mt-1.5" name={field.name} type={field.type ?? 'text'} step={field.step} min={field.min} max={field.max} maxlength={field.maxlength} required={field.required ?? true} value={values[field.name] ?? field.value ?? ''} />
    </label>
  {/if}
{/each}
