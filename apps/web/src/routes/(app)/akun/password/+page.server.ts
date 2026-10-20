import { submitPasswordChange } from '$lib/server/password';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async event => {
    const result = await submitPasswordChange(event, { requireCurrent: true });
    return 'user' in result ? { saved: true as const, message: 'Kata sandi berhasil diubah. Sesi di perangkat lain telah diakhiri.' } : result;
  },
};
