import { randomBytes } from 'node:crypto';
import { AuthError } from './auth.model';

const temporaryAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function validateNewPassword(password: string, confirmation: string) {
  if (password !== confirmation) throw new AuthError(400, 'Konfirmasi kata sandi tidak sama.');
  if (password.length < 12 || password.length > 1024) {
    throw new AuthError(400, 'Kata sandi baru harus terdiri dari 12–1024 karakter.');
  }
}

export function generateTemporaryPassword() {
  const characters: string[] = [];
  const ceiling = Math.floor(256 / temporaryAlphabet.length) * temporaryAlphabet.length;
  while (characters.length < 12) {
    for (const byte of randomBytes(16)) {
      if (byte >= ceiling) continue;
      characters.push(temporaryAlphabet[byte % temporaryAlphabet.length]!);
      if (characters.length === 12) break;
    }
  }
  return [characters.slice(0, 4), characters.slice(4, 8), characters.slice(8, 12)]
    .map(part => part.join('')).join('-');
}

export const hashPassword = (password: string) => Bun.password.hash(password, { algorithm: 'argon2id' });
