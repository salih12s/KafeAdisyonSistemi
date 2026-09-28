import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';
import { ENV_FILE_PATH } from './src/config/paths';

dotenv.config({ path: ENV_FILE_PATH });

// Prisma 7 CLI bağlantı adresini buradan okur; uygulama src/lib/database.ts
// içindeki MariaDB adapter'ını kullanır. `prisma generate` adres gerektirmez.
const databaseUrl = process.env.DATABASE_URL?.trim();
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL?.trim() || undefined;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: databaseUrl ? { url: databaseUrl, shadowDatabaseUrl } : undefined,
});
