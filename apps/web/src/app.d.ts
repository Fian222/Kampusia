import type { AuthUser } from 'api';

declare global {
  namespace App {
    interface Locals { user: AuthUser | null }
  }
}

export {};
