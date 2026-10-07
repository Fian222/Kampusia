import { goto } from '$app/navigation';
import { formQueryHref } from '$lib/navigation/query';
import { createNavigationScheduler } from '$lib/navigation/scheduler';
import { tick } from 'svelte';

type Options = {
  debounce?: number;
  pageKey?: string;
};

type ControlSnapshot = {
  name: string;
  occurrence: number;
  value: string;
  checked?: boolean;
  selectedLabel?: string;
};

function preserveDialogForm(lookupForm: HTMLFormElement) {
  const dialog = lookupForm.closest('dialog');
  const forms = dialog ? [...dialog.querySelectorAll<HTMLFormElement>('form[method="POST"]')] : [];
  const snapshots = forms.map(form => {
    const occurrences = new Map<string, number>();
    return [...form.elements].flatMap<ControlSnapshot>(element => {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) || !element.name) return [];
      const occurrence = occurrences.get(element.name) ?? 0;
      occurrences.set(element.name, occurrence + 1);
      return [{
        name: element.name, occurrence,
        value: element.value,
        checked: element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type) ? element.checked : undefined,
        selectedLabel: element instanceof HTMLSelectElement ? element.selectedOptions[0]?.textContent ?? undefined : undefined,
      }];
    });
  });

  return () => {
    const currentForms = dialog ? [...dialog.querySelectorAll<HTMLFormElement>('form[method="POST"]')] : forms;
    currentForms.forEach((form, formIndex) => {
      const occurrences = new Map<string, number>();
      [...form.elements].forEach(element => {
        if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) || !element.name) return;
        const occurrence = occurrences.get(element.name) ?? 0;
        occurrences.set(element.name, occurrence + 1);
        const snapshot = snapshots[formIndex]?.find(snapshot => snapshot.name === element.name && snapshot.occurrence === occurrence);
        if (!snapshot) return;
        if (element instanceof HTMLSelectElement && snapshot.value && ![...element.options].some(option => option.value === snapshot.value)) {
          element.add(new Option(snapshot.selectedLabel ?? 'Pilihan tersimpan', snapshot.value));
        }
        element.value = snapshot.value;
        element.dispatchEvent(new Event('kampusia:restore'));
        if (element instanceof HTMLInputElement && snapshot.checked !== undefined) element.checked = snapshot.checked;
      });
    });
  };
}

/** Keeps GET forms usable without JavaScript while upgrading them to URL-backed SvelteKit navigation. */
export function seamlessFilter(form: HTMLFormElement, options: Options = {}) {
  const scheduler = createNavigationScheduler({
    debounce: options.debounce,
    currentHref: () => window.location.pathname + window.location.search,
    targetHref: () => formQueryHref(form, new URL(window.location.href), options.pageKey),
    navigate: async href => {
      form.querySelector('[data-filter-error]')?.remove();
      const restoreDialogForm = preserveDialogForm(form);
      try {
        await goto(href, { replaceState: true, noScroll: true, keepFocus: true });
        await tick();
        restoreDialogForm();
      } catch (cause) {
        const feedback = document.createElement('p');
        feedback.dataset.filterError = '';
        feedback.setAttribute('role', 'alert');
        feedback.className = 'text-sm text-red-700 sm:col-span-full';
        feedback.textContent = 'Filter belum diterapkan. Periksa koneksi lalu coba lagi. ';
        const retry = document.createElement('button');
        retry.type = 'submit';
        retry.className = 'action-secondary';
        retry.textContent = 'Coba lagi';
        feedback.append(retry);
        form.append(feedback);
        throw cause;
      }
    },
  });

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    void scheduler.immediate();
  };
  const change = (event: Event) => {
    if (event.target instanceof Element && event.target.closest('[data-selection-popup]')) return;
    if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement && ['checkbox', 'radio', 'number', 'date'].includes(event.target.type)) {
      void scheduler.immediate();
    }
  };
  const input = (event: Event) => {
    if (event.target instanceof Element && event.target.closest('[data-selection-popup]')) return;
    if (!(event.target instanceof HTMLInputElement) || !['text', 'search'].includes(event.target.type)) return;
    scheduler.debounce();
  };
  const click = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('a[href]')) scheduler.destroy();
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    void scheduler.immediate();
  };

  form.addEventListener('submit', submit);
  form.addEventListener('change', change);
  form.addEventListener('input', input);
  form.addEventListener('click', click);
  form.addEventListener('keydown', keydown);

  return {
    destroy() {
      scheduler.destroy();
      form.removeEventListener('submit', submit);
      form.removeEventListener('change', change);
      form.removeEventListener('input', input);
      form.removeEventListener('click', click);
      form.removeEventListener('keydown', keydown);
    },
  };
}
