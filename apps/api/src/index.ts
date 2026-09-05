import { app } from './app';

const port = Number(Bun.env.API_PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('API_PORT must be an integer between 1 and 65535.');
}

app.listen(port);
console.log(`Kampusia API listening on http://localhost:${port}`);
