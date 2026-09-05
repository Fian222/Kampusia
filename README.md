# Kampusia

Bun workspace monorepo for a campus information system. This initial scaffold has no academic features, database tables, or API endpoints.

## Structure

- `apps/web` (`web`): SvelteKit, TypeScript, Tailwind CSS, and an Eden Treaty client factory.
- `apps/api` (`api`): Elysia server, with separate app and server entry points. The app type is exported for Eden.
- `packages/db` (`@kampusia/db`): PostgreSQL client factory, Drizzle configuration, and empty schema/migration directories. Import database utilities using `@kampusia/db`.
- `tsconfig.base.json`: shared strict TypeScript options. The web workspace also extends SvelteKit's generated configuration.

## Setup

Install Bun 1.3 or newer and Node.js 22.12 or newer (for Vite tooling).

From the repository root:

```sh
bun install
bun dev
```

The frontend runs at http://localhost:5173 and the API at http://localhost:3000. The API has no routes yet, so requests return 404. PostgreSQL is not needed to start the scaffold.

For local environment settings, copy each workspace's `.env.example` to `.env` in the same directory. Workspace commands run from their own directory. Set `DATABASE_URL` in `packages/db/.env` before using database commands, and in `apps/api/.env` when database access is added. `JWT_SECRET` and `WEB_URL` are reserved for future authentication and CORS configuration. The Eden factory accepts a URL; future callers can supply `PUBLIC_API_URL` from SvelteKit's public environment.

## Commands

| Command | Purpose |
| --- | --- |
| `bun dev` | Run frontend and backend together |
| `bun --filter web dev` | Run frontend only |
| `bun --filter api dev` | Run backend with watch mode |
| `bun run check` | Type-check all workspaces, including Svelte components |
| `bun run build` | Build frontend and backend |
| `bun --filter web preview` | Preview the frontend build |
| `bun --filter api start` | Run the built API |
| `bun test` | Run tests once business-rule tests are added |
| `bun run db:generate` | Generate migrations from Drizzle schemas |
| `bun run db:migrate` | Apply migrations to the configured PostgreSQL database |
| `bun run db:studio` | Open Drizzle Studio |

There are no tests or lint configuration yet. The database package exports TypeScript source consumed by Bun and has no separate build. No database changes have been applied. Add domain schemas under `packages/db/schema`, export them from its index, generate a migration, inspect it, then apply it.

The frontend uses adapter-auto; select an adapter for the eventual deployment target before production deployment. The build command is not a deployment.
