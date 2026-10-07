type ConfirmationResult = { type: 'success' | 'failure' | 'redirect' | 'error'; data?: unknown };

/** Failed confirmations keep their context and input; transport errors stay in the dialog. */
export async function finishConfirmation(
  result: ConfirmationResult,
  update: (options: { reset: boolean }) => Promise<void>,
  close: () => void,
  showError: (message: string | null) => void,
) {
  showError(null);
  if (result.type === 'failure' || result.type === 'error') {
    const data = result.data;
    const message = data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
      ? data.message : 'Perubahan belum tersimpan. Silakan coba lagi.';
    showError(message);
    if (result.type === 'failure') await update({ reset: false });
    return;
  }
  await update({ reset: false });
  if (result.type === 'success') close();
}
