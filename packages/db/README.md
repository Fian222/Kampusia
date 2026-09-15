# Kampusia database package

The schema implements the 20 tables in [DATABASE.md](../../docs/DATABASE.md). Each table has its own file under `schema/`; `schema/index.ts` exports the tables and Drizzle query relations. PostgreSQL names use snake_case; TypeScript properties use camelCase.

The initial migration is `migrations/0000_initial.sql`; additive migrations create the attendance and grading extensions. Their Drizzle snapshots and journal metadata are in `migrations/meta/`. The initial migration was applied and verified against the local Podman `kampusia` development database on 2026-09-05, the attendance migration on 2026-09-14, and the grading migration on 2026-09-15. Other databases must run their own migration command.

Local migration verification confirms 20 application tables, 35 foreign keys, 24 ordinary unique constraints, 68 CHECK constraints, and 65 indexes including three partial unique indexes. The grading integration fixtures always roll back.

Use `bun run db:seed` for repeatable development data. See [development setup](../../docs/DEVELOPMENT.md) for fixture contents, credentials, environment settings, and the opt-in live seed test.

During this verification, Podman PostgreSQL was healthy but Windows localhost port forwarding was unavailable. A temporary SSH tunnel through the existing Podman machine connection was used for migration and verification, then closed. Restore Podman's localhost:5432 forwarding before connecting directly from Windows; this does not require schema changes or regeneration.

## Commands

Run from the repository root:

```sh
bun run check
bun test packages/db/src/schema.test.ts
bun run db:generate
bun run db:check
RUN_ATTENDANCE_DB_TESTS=1 bun --env-file=packages/db/.env test packages/db/src/attendance-schema.integration.test.ts
RUN_GRADING_DB_TESTS=1 bun --env-file=packages/db/.env test packages/db/src/grading-schema.integration.test.ts
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
- Meeting dates within the owning semester, allowed class states for meeting creation, meeting lifecycle transitions, coordinated class cancellation, completion with full effective-roster coverage, and authorized factual corrections.
- Attendance eligibility through effective approved enrollment, actor role/activity/lecturer-assignment authorization, incremental entry and finalization behavior, late insertion policy, correction requirements, and preservation across later KRS changes. Missing attendance rows remain unrecorded and are never interpreted or defaulted to ALPHA by the schema.
- Grading component total weight of exactly 100.00, effective-enrollment score eligibility, grading authorization, configuration freezing, complete-roster finalization, exact calculation and rounding, letter/index policy mapping, controlled correction behavior, and historical-retention workflows. Missing scores remain null or absent and are never defaulted to zero by the schema.
- The shared locking/serializable transaction and retry protocol, explicit active-semester switching, and updates to `updated_at` on mutations.

Student counts, selected SKS, KHS, IPS, and IPK remain derived as specified in DATABASE.md; no counters or extra result tables have been introduced. These service rules must be implemented before exposing grading mutations through an API. No triggers or undocumented tables have been added to approximate them.
