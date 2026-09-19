import { expect, test } from 'bun:test';
import { generateTemporaryPassword, hashPassword, validateNewPassword } from './password';

test('temporary passwords use the readable secure format without predictable identity data', () => {
  const values = Array.from({ length: 64 }, generateTemporaryPassword);
  expect(new Set(values).size).toBe(values.length);
  for (const value of values) expect(value).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/);
});

test('new password validation requires matching values and at least twelve characters', () => {
  expect(() => validateNewPassword('A-New-Password', 'A-New-Password')).not.toThrow();
  expect(() => validateNewPassword('too-short', 'too-short')).toThrow('12–1024');
  expect(() => validateNewPassword('A-New-Password', 'Different-Password')).toThrow('tidak sama');
});

test('password hashing stores a verifier rather than plaintext', async () => {
  const password = generateTemporaryPassword();
  const hash = await hashPassword(password);
  expect(hash).not.toContain(password);
  expect(hash.startsWith('$argon2id$')).toBe(true);
  expect(await Bun.password.verify(password, hash)).toBe(true);
});
