import { goto } from '$app/navigation';
import { formQueryHref } from '$lib/navigation/query';
import { createNavigationScheduler } from '$lib/navigation/scheduler';
import { tick } from 'svelte';

type Options = {
  debounce?: number;
  pageKey?: string;
};

type ControlSnapshot = {
  value: string;
  checked?: boolean;
  selectedLabel?: string;
};

function preserveDialogForm(lookupForm: HTMLFormElement) {
  const dialog = lookupForm.closest('dialog');
  const forms = dialog ? [...dialog.querySelectorAll<HTMLFormElement>('form[method="POST"]')] : [];
  const snapshots = forms.map(form => [...form.elements].map<ControlSnapshot | null>(element => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return null;
    return {
      value: element.value,
      checked: element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type) ? element.checked : undefined,
      selectedLabel: element instanceof HTMLSelectElement ? element.selectedOptions[0]?.textContent ?? undefined : undefined,
    };
  }));

  return () => {
    const currentForms = dialog ? [...dialog.querySelectorAll<HTMLFormElement>('form[method="POST"]')] : forms;
    currentForms.forEach((form, formIndex) => {
      [...form.elements].forEach((element, controlIndex) => {
        const snapshot = snapshots[formIndex]?.[controlIndex];
        if (!snapshot || !(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return;
        if (element instanceof HTMLSelectElement && snapshot.value && ![...element.options].some(option => option.value === snapshot.value)) {
          element.add(new Option(snapshot.selectedLabel ?? 'Pilihan tersimpan', snapshot.value));
        }
        element.value = snapshot.value;
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
      const restoreDialogForm = preserveDialogForm(form);
      await goto(href, {
        replaceState: true,
        noScroll: true,
        keepFocus: true,
      });
      await tick();
      restoreDialogForm();
    },
  });

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    void scheduler.immediate();
  };
  const change = (event: Event) => {
    if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement && ['checkbox', 'radio', 'number', 'date'].includes(event.target.type)) {
      void scheduler.immediate();
    }
  };
  const input = (event: Event) => {
    if (!(event.target instanceof HTMLInputElement) || !['text', 'search'].includes(event.target.type)) return;
    scheduler.debounce();
  };
  const click = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('a[href]')) scheduler.destroy();
  };

  form.addEventListener('submit', submit);
  form.addEventListener('change', change);
  form.addEventListener('input', input);
  form.addEventListener('click', click);

  return {
    destroy() {
      scheduler.destroy();
      form.removeEventListener('submit', submit);
      form.removeEventListener('change', change);
      form.removeEventListener('input', input);
      form.removeEventListener('click', click);
    },
  };
}
