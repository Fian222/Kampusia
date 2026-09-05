import { treaty } from '@elysiajs/eden';
import type { App } from 'api';

export function createApiClient(url: string) {
  return treaty<App>(url);
}
