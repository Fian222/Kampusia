import { treaty } from '@elysiajs/eden';
import type { App } from 'api';

export function createApiClient(url: string, headers?: Record<string, string>) {
  return treaty<App>(url, { headers });
}
