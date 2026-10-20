import type { SessionUser } from 'api';

declare global {
  namespace App {
    interface Locals { user: SessionUser | null }
  }
}

export {};
