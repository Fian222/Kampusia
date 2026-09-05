import { createDatabase } from '@kampusia/db';
import { createApp } from './app';
import { createAuthRepository } from './modules/auth/auth.repository';
import { createAuthService } from './modules/auth/auth.service';

const port = Number(Bun.env.API_PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('API_PORT must be an integer between 1 and 65535.');
}

const production = Bun.env.NODE_ENV === 'production';
const webOrigin = new URL(Bun.env.WEB_URL ?? 'http://localhost:5173').origin;
if (production && !webOrigin.startsWith('https://')) throw new Error('Production WEB_URL must use HTTPS.');
const { db, client } = createDatabase(Bun.env.DATABASE_URL ?? '');
const app = createApp(createAuthService(createAuthRepository(db)), { webOrigin, production });
app.listen(port);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => { await app.stop(); await client.end(); process.exit(0); });
}
console.log(`Kampusia API listening on http://localhost:${port}`);
