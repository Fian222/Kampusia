import { requireRole } from './authorization';
import { AuthError, type AuthUser } from '../modules/auth/auth.model';

export function requireMasterData(user: AuthUser, request: Request, webOrigin: string) {
  requireRole(user, ['ADMIN', 'AKADEMIK']);
  if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== webOrigin) {
    throw new AuthError(403, 'Asal permintaan tidak diizinkan.');
  }
}
