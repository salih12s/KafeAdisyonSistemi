import dotenv from 'dotenv';
import prompts from 'prompts';
import { ENV_FILE_PATH } from '../config/paths';
import { parseEnv } from '../config/env';
import { createPrismaClient } from '../lib/database';
import { createPrismaStore } from '../features/prisma-store';
import { IdentityService, normalizeUsername } from '../features/identity-service';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../features/password';

type AnswerKey = 'businessName' | 'fullName' | 'username' | 'password' | 'passwordConfirmation';

function required(value: string): true | string {
  return value.trim().length > 0 || 'Bu alan zorunludur.';
}

async function main(): Promise<number> {
  dotenv.config({ path: ENV_FILE_PATH });
  const env = parseEnv(process.env);
  const client = createPrismaClient(env.DATABASE_URL);
  const identity = new IdentityService(createPrismaStore(client));

  try {
    if (await identity.setupStatus()) {
      process.stderr.write('Aktif işletme sahibi zaten mevcut; kurulum yeniden çalıştırılamaz.\n');
      return 1;
    }

    const answers = await prompts<AnswerKey>(
      [
        { type: 'text', name: 'businessName', message: 'İşletme adı:', validate: required },
        { type: 'text', name: 'fullName', message: 'İşletme sahibinin adı:', validate: required },
        { type: 'text', name: 'username', message: 'Kullanıcı adı:', validate: required },
        {
          type: 'password',
          name: 'password',
          message: 'Şifre:',
          validate: (value: string) =>
            (value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH) ||
            `Şifre ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} karakter arasında olmalıdır.`,
        },
        {
          type: 'password',
          name: 'passwordConfirmation',
          message: 'Şifre tekrarı:',
          validate: (value: string, values: Partial<Record<AnswerKey, string>>) =>
            value === values.password || 'Şifreler eşleşmiyor.',
        },
      ],
      {
        onCancel: () => {
          process.stderr.write('Kurulum iptal edildi; hiçbir kayıt oluşturulmadı.\n');
          return false;
        },
      },
    );

    const businessName = answers.businessName;
    const fullName = answers.fullName;
    const username = answers.username;
    const password = answers.password;
    const passwordConfirmation = answers.passwordConfirmation;
    if (
      businessName === undefined ||
      fullName === undefined ||
      username === undefined ||
      password === undefined ||
      passwordConfirmation === undefined
    ) {
      return 1;
    }
    if (password !== passwordConfirmation) {
      process.stderr.write('Şifreler eşleşmiyor.\n');
      return 1;
    }

    const owner = await identity.bootstrapOwner({ businessName, fullName, username, password });
    process.stdout.write(`İşletme sahibi oluşturuldu: ${normalizeUsername(owner.username)}\n`);
    process.stdout.write(`Giriş adresi: http://localhost:${env.PORT}/login\n`);
    return 0;
  } finally {
    await client.$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(
      `Kurulum tamamlanamadı: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
