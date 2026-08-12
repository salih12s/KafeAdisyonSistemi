import { describe, expect, it } from 'vitest';
import { hashPassword, PASSWORD_COST, verifyPassword } from '../src/features/password';

describe('Şifre güvenliği', () => {
  it('şifreyi bcrypt cost 12 ile hashler', async () => {
    const hash = await hashPassword('GuvenliTest12!');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(PASSWORD_COST).toBe(12);
  });

  it('doğru şifreyi doğrular', async () => {
    const hash = await hashPassword('GuvenliTest12!');
    await expect(verifyPassword('GuvenliTest12!', hash)).resolves.toBe(true);
  });

  it('yanlış şifreyi reddeder', async () => {
    const hash = await hashPassword('GuvenliTest12!');
    await expect(verifyPassword('YanlisTest12!', hash)).resolves.toBe(false);
  });

  it('hash ile düz metin aynı değildir', async () => {
    const password = 'GuvenliTest12!';
    await expect(hashPassword(password)).resolves.not.toBe(password);
  });
});
