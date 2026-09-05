# Kampusia

Bun workspace monorepo for a campus information system. The initial database, development seed, cookie authentication, and role-protected dashboard placeholders are implemented. Academic CRUD features are not implemented.

## Structure

- `apps/web` (`web`): SvelteKit, TypeScript, Tailwind CSS, and an Eden Treaty client factory.
- `apps/api` (`api`): Elysia server, with separate app and server entry points. The app type is exported for Eden.
- `packages/db` (`@kampusia/db`): PostgreSQL client factory, 15 Drizzle tables with query relations, and the initial migration. Import database utilities using `@kampusia/db` and tables using `@kampusia/db/schema`.
- `tsconfig.base.json`: shared strict TypeScript options. The web workspace also extends SvelteKit's generated configuration.

## Setup

Install Bun 1.3 or newer and Node.js 22.12 or newer (for Vite tooling).

From the repository root:

```sh
bun install
bun dev
```

The frontend runs at http://localhost:5173 and the API at http://localhost:3000. Open `/login` to sign in. PostgreSQL must be running with the existing migrations applied; see [development setup and demo credentials](docs/DEVELOPMENT.md).

For local environment settings, copy each workspace's `.env.example` to `.env` in the same directory. Workspace commands run from their own directory. Set `DATABASE_URL` in `packages/db/.env` for database commands and in `apps/api/.env` for authentication. Set the API's `WEB_URL` to the exact web origin. The frontend uses server-only `API_URL` for Eden requests. See [authentication notes](docs/AUTHENTICATION.md) for cookie and session configuration.

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
| `bun test` | Run schema, seed validation, and authentication tests |
| `bun run db:generate` | Generate migrations from Drizzle schemas |
| `bun run db:check` | Validate Drizzle migration metadata |
| `bun run db:seed` | Create repeatable local development data; see [development setup](docs/DEVELOPMENT.md) |
| `bun run db:migrate` | Apply migrations to the configured PostgreSQL database |
| `bun run db:studio` | Open Drizzle Studio |

Database schema-contract tests run with `bun test`. There is no lint configuration yet. The database package exports TypeScript source consumed by Bun and has no separate build. The initial migration has been applied and verified on the local Podman development database; other databases must run their own migrations. Read [DATABASE.md](docs/DATABASE.md) before database changes and [database package notes](packages/db/README.md) for commands, local connectivity notes, and enforcement boundaries.

The frontend uses adapter-auto; select an adapter for the eventual deployment target before production deployment. The build command is not a deployment.
