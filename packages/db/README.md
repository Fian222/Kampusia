# Kampusia database package

The schema implements the 15 tables in [DATABASE.md](../../docs/DATABASE.md). Each table has its own file under `schema/`; `schema/index.ts` exports the tables and Drizzle query relations. PostgreSQL names use snake_case; TypeScript properties use camelCase.

The initial migration is `migrations/0000_initial.sql`, with Drizzle snapshot and journal metadata in `migrations/meta/`. It has been generated, not applied.

## Commands

Run from the repository root:

```sh
bun run check
bun test packages/db/src/schema.test.ts
bun run db:generate
bun run db:check
```

Generation and migration-history checks do not need a database connection. `db:check` validates Drizzle migration metadata; it does not execute the SQL or compare a live database. The tests compare schema metadata with DATABASE.md and compile relational queries without connecting to PostgreSQL.

For migration or Studio access, copy `packages/db/.env.example` to `packages/db/.env` and supply `DATABASE_URL`. Existing configuration is sufficient; no additional environment variable is required. Bun loads that workspace's environment when running its scripts.

After reviewing the migration and confirming the target database, apply it explicitly with:

```sh
bun run db:migrate
```

Use `bun run db:studio` to inspect the configured database. Do not use schema push as a substitute for committed migrations.

## Enforcement boundary

All documented column definitions, row-local CHECK constraints, foreign keys, unique constraints, partial unique indexes, and additional indexes are represented in Drizzle and generated SQL. This includes the non-null `(kurikulum_id, program_studi_id)` reference from mahasiswa to `kurikulum (id, program_studi_id)`.

The following documented rules require future service logic and transactions rather than ordinary declarative Drizzle constraints. They are not implemented by this schema or by Drizzle query relations:

- Account role compatibility, exclusion of simultaneous student/lecturer links, secure password hashing, active-account checks, and authorization.
- Class-opening requirements: a course in at least one curriculum of the offering program, active resources, lecturer assignments, and valid schedules.
- KRS/class semester compatibility, student program and curriculum eligibility, duplicate course selections across different classes, total SKS limits, and at least one selection at submission/approval.
- Room, class, lecturer, and student schedule conflicts; room capacity versus class capacity; class capacity versus derived approved active enrollment counts; occurrence of weekly slots within semester dates.
- Workflow transitions, timestamp changes across transitions, coordinated cancellation/reactivation, record immutability, permitted deletion, deactivation, and historical retention policies beyond foreign-key restrictions. The database CHECKs enforce valid timestamp combinations within each KRS row, not the sequence of changes.
- The shared locking/serializable transaction and retry protocol, explicit active-semester switching, and updates to `updated_at` on mutations.

Student counts and selected SKS remain derived as specified in DATABASE.md; no counters or extra columns have been introduced. These service rules must be implemented before exposing academic mutations through an API. No triggers or undocumented tables have been added to approximate them.
