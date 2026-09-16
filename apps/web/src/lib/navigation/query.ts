export type QueryChange = string | number | null | undefined;

export function queryHref(
  url: URL,
  changes: Record<string, QueryChange>,
  { resetPage = false, pageKey = 'page' }: { resetPage?: boolean; pageKey?: string } = {},
) {
  const params = new URLSearchParams(url.searchParams);

  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === '') params.delete(key);
    else params.set(key, String(value));
  }

  if (resetPage) params.delete(pageKey);
  const query = params.toString();
  return `${url.pathname}${query ? `?${query}` : ''}`;
}

export function formQueryHref(form: HTMLFormElement, url: URL, pageKey = 'page') {
  const changes: Record<string, QueryChange> = {};
  const formData = new FormData(form);

  for (const element of form.elements) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue;
    if (!element.name || element.disabled) continue;
    const values = formData.getAll(element.name).map(String);
    changes[element.name] = values.at(-1) ?? null;
  }

  return queryHref(url, changes, { resetPage: true, pageKey });
}
