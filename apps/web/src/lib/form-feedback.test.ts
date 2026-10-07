import { expect, test } from 'bun:test';
import { finishConfirmation } from './form-feedback';

test('failed domain confirmation stays open with its error and input intact', async () => {
  let closed = false;
  const feedback: { message: string | null } = { message: null };
  const updates: { reset: boolean }[] = [];
  await finishConfirmation({ type: 'failure', data: { message: 'Kurikulum sudah digunakan.' } }, async options => { updates.push(options); }, () => { closed = true; }, value => { feedback.message = value; });
  expect(closed).toBe(false);
  expect(feedback.message).toBe('Kurikulum sudah digunakan.');
  expect(updates).toEqual([{ reset: false }]);
});

test('transport errors allow retry without navigating away from the confirmation', async () => {
  let updated = false;
  let closed = false;
  const feedback: { message: string | null } = { message: null };
  await finishConfirmation({ type: 'error' }, async () => { updated = true; }, () => { closed = true; }, value => { feedback.message = value; });
  expect(updated).toBe(false);
  expect(closed).toBe(false);
  expect(feedback.message).toBe('Perubahan belum tersimpan. Silakan coba lagi.');
});

test('successful confirmation refreshes data before closing and clears old feedback', async () => {
  const calls: string[] = [];
  await finishConfirmation({ type: 'success' }, async () => { calls.push('update'); }, () => { calls.push('close'); }, value => { expect(value).toBeNull(); });
  expect(calls).toEqual(['update', 'close']);
});
