import { queryHref } from './query';

type EditModalInput = {
  queryEditId: string | null;
  requestedEditId: string | null;
  loadedEditId: string | null;
  createRequested: boolean;
  saveFailed: boolean;
  failedEditId?: string | null;
};

export function resolveEditModalState(input: EditModalInput) {
  const editId = input.queryEditId ?? input.requestedEditId ?? input.failedEditId ?? null;
  const editing = editId !== null;
  const open = editing || input.createRequested || input.saveFailed;

  return {
    open,
    editing,
    editId,
    loading: editing && input.loadedEditId !== editId,
  };
}

export function editQueryHref(url: URL, id: string) {
  return queryHref(url, { edit: id, modal: null });
}

export function clearEditQueryHref(url: URL) {
  return queryHref(url, { edit: null, modal: null });
}
