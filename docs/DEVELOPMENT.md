# Kampusia development

## Running the application

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env`. These local files are Git-ignored. Set the API's `DATABASE_URL` to the migrated local database, `WEB_URL=http://localhost:5173`, and `NODE_ENV=development`. The web server uses the private `API_URL=http://localhost:3000` to contact the API through Eden Treaty.

Run `bun dev` from the repository root, then open http://localhost:5173/login. PostgreSQL must be running, migrations applied, and the development seed present to use the demo account below. See [authentication notes](AUTHENTICATION.md) for session behavior and deployment configuration.

## Development seed

This seed is for the local development database only. Apply the existing migration first, then add these values to the Git-ignored `packages/db/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kampusia
NODE_ENV=development
SEED_PASSWORD=KampusiaDemo2026!
```

Run from the repository root:

```sh
bun run db:seed
```

The seed requires `NODE_ENV=development`, a loopback PostgreSQL URL for database `kampusia` on port 5432, and a password of at least 12 characters. It uses the existing Drizzle schema and does not run migrations. PostgreSQL runs in Podman; use `podman compose up -d` if the service is stopped.

## Demo credentials

| Role | Email | Password with the example environment above |
| --- | --- | --- |
| AKADEMIK | akademik@kampusia.test | KampusiaDemo2026! |

Use these credentials only for development. The database stores a salted Argon2id hash produced by Bun, never the plaintext password. A different `SEED_PASSWORD` can be chosen for the first run. Reruns preserve the existing hash and do not reset credentials. Student and lecturer academic records are created without login accounts. Signing in with the demo account opens `/akademik`.

## Authentication verification

`bun test` includes isolated API tests for login, invalid credentials, inactive accounts, cookies, logout/revocation, current user, session expiry, and all four roles. These tests use an in-memory repository and do not modify PostgreSQL.

For the opt-in HTTP integration test, keep `bun dev` running with the local database and existing seed, then run this in a second PowerShell terminal from the repository root:

```powershell
$env:RUN_AUTH_E2E = '1'
bun --env-file=packages/db/.env test apps/web/src/lib/server/auth-flow.test.ts
Remove-Item Env:RUN_AUTH_E2E
```

The test reads `SEED_PASSWORD`, signs in through the SvelteKit form action, checks the rendered dashboard and role restriction, and signs out. It creates only temporary API sessions and does not change the database. It is skipped during ordinary test runs.

## Sample academic data

The fixture includes Fakultas Teknik (`DEV-FT`), Informatika S1 (`DEV-IF`), Kurikulum Informatika 2026, five 3-SKS courses, two demo lecturers, five AKTIF students (`DEV20260001` through `DEV20260005`), and three rooms. NIDNs are left null. Curriculum semester recommendations are 1 for Algoritma dan Pemrograman, 3 for Basis Data and Struktur Data, and 5 for Pemrograman Web and Sistem Operasi. Recommendations do not restrict KRS eligibility in the initial design.

Semester `20261` is explicitly activated with dates 2026-08-24 through 2027-01-15. Any other active semester is deactivated in the same transaction. All five classes are opened with capacity 30. Each has a coordinator; Basis Data has both lecturers assigned. Local weekly times are Asia/Jakarta:

| Course / class A | Day | Time | Room | Expected active students |
| --- | --- | --- | --- | --- |
| Algoritma dan Pemrograman | Monday | 08:00–10:30 | DEV-R101 | 0 |
| Basis Data | Tuesday | 08:00–10:30 | DEV-R102 | 3 |
| Pemrograman Web | Wednesday | 08:00–10:30 | DEV-LAB1 | 2 |
| Struktur Data | Thursday | 08:00–10:30 | DEV-R101 | 1 |
| Sistem Operasi | Friday | 08:00–10:30 | DEV-R102 | 1 |

The first three students have approved KRS: student 1 selects Basis Data, Pemrograman Web, and Struktur Data (9 SKS); student 2 selects Basis Data and Pemrograman Web (6 SKS); student 3 selects Basis Data and Sistem Operasi (6 SKS). Each has an 18-SKS limit. Submission and approval timestamps and the AKADEMIK approver are populated. Students 4 and 5 have no KRS yet.

## Repeatability and validation

The seed uses fixed fixture UUIDs and development-prefixed business identifiers. The AKADEMIK fixture account identifies an existing complete seed. On rerun, all fixture records are checked and retained rather than reinserted. Existing password hashes and timestamps are preserved, except timestamps on an explicitly changed active-semester flag. Existing academic fixture edits, partial fixtures, or business identifiers owned by different UUIDs cause an error and full rollback; the seed does not reset or take over those records.

All writes and checks run in one serializable transaction, with up to three attempts for serialization/deadlock failures. Because this is a small development maintenance operation, it briefly locks the 15 tables against concurrent writes. Classes start as DRAFT, receive lecturers and schedules, then become DIBUKA. KRS proceeds from DRAFT through DIAJUKAN to DISETUJUI. Final fixture, schedule-conflict, and enrollment-capacity checks occur before commit. Any failure rolls back all changes, including the active-semester switch.

The output uses the documented count of AKTIF details on DISETUJUI KRS, including any additional existing enrollments. The counts above describe the unmodified fixture. No student counter is stored.

Run ordinary schema and fixture tests with `bun test`. To run the opt-in live test against the local development database, use PowerShell from the repository root:

```powershell
$env:RUN_DB_SEED_TESTS = '1'
$env:NODE_ENV = 'development'
bun --cwd packages/db test src/seed.test.ts
Remove-Item Env:RUN_DB_SEED_TESTS
Remove-Item Env:NODE_ENV
```

The live test runs the seed twice, compares fingerprints of all 15 tables (including UUIDs, timestamps, and stored password hashes), verifies the password, checks curriculum integrity and validated foreign keys, and checks the expected enrollment counts. It is intended for this unmodified demo fixture. It does not delete or reset data.
