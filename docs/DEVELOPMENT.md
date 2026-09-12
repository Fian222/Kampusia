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

## Fakultas and Program Studi master data

ADMIN and AKADEMIK share `/akademik/fakultas` and `/akademik/program-studi`, linked from their existing sidebars. Their dashboards remain role-specific. Both master-data APIs require an active authenticated ADMIN/AKADEMIK account; mutations also require the configured web origin.

Each resource exposes `GET /resource`, `GET /resource/:id`, `POST /resource`, and `PATCH /resource/:id`, where resource is `fakultas` or `program-studi`. There is no DELETE endpoint. Lists accept `page` (default 1), `limit` (default 20, maximum 100), `search` (literal case-insensitive code/name substring), and `is_active=true|false`. Omit status to include historical inactive records. Program Studi also accepts `fakultas_id` and `jenjang`.

Write payloads use `kode`, `nama`, and optional `is_active`; Program Studi additionally requires `fakultas_id` and `jenjang` on creation. PATCH accepts individual fields and rejects an empty body. Responses retain Drizzle's camelCase properties (`isActive`, `fakultasId`, timestamps); Program Studi list/detail includes a small related `fakultas` object. Unique normalized codes return 409 with an Indonesian validation message. Missing records return 404; invalid input or faculty assignments return 400.

Deactivation preserves related records. Creating a program, moving it to another faculty, or reactivating it requires an active faculty. Editing an unchanged historical assignment remains allowed. Program writes validate within transactions and lock faculty rows against concurrent deactivation. Changing faculty is an administrative correction; the form explicitly calls attention to its historical meaning. No schema, migrations, or seed records were changed.

The Program Studi page uses a separate paginated faculty search for filter/form choices, so even the faculty selector does not download the entire dataset. Search/select the relevant faculty before filling the program form. Status changes use an explicit confirmation and never delete records.

`bun test` includes isolated academic API tests. To exercise real Drizzle queries and PostgreSQL constraints with temporary fixtures that are fully rolled back:

```powershell
$env:RUN_MASTER_DB_TESTS = '1'
bun --env-file=packages/db/.env test apps/api/src/modules/master-data.integration.test.ts
Remove-Item Env:RUN_MASTER_DB_TESTS
```

With `bun dev` running and the development seed present, verify server-rendered pages, edit forms, search, validation, and cross-origin rejection without changing academic records:

```powershell
$env:RUN_MASTER_E2E = '1'
bun --env-file=packages/db/.env test apps/web/src/lib/server/master-data-flow.test.ts
Remove-Item Env:RUN_MASTER_E2E
```

## Mahasiswa and Dosen master data

ADMIN and AKADEMIK share `/akademik/mahasiswa` and `/akademik/dosen`, available from both sidebars. Both APIs require these roles for reads and writes; mutations require the configured web origin. Existing student/lecturer dashboards and authentication behavior are unchanged.

Each resource exposes `GET /resource`, `GET /resource/:id`, `POST /resource`, and `PATCH /resource/:id`, where resource is `mahasiswa` or `dosen`. There are no DELETE endpoints. Lists use the same `page`, `limit` (maximum 100), and literal case-insensitive `search` conventions as Fakultas/Program Studi. Mahasiswa searches NIM/name and accepts `program_studi_id`, `kurikulum_id`, `angkatan`, and `status`. Dosen searches code/NIDN/name and accepts `program_studi_id` and `is_active=true|false`. SQL handles filtering, counting, ordering, and pagination; list/count use a consistent transaction snapshot.

Mahasiswa creation requires `nim`, `nama`, `program_studi_id`, `kurikulum_id`, and integer `angkatan` between 1900 and 9999. Optional `status` defaults to AKTIF; valid values are AKTIF, CUTI, LULUS, KELUAR, NONAKTIF. Dosen requires `kode_dosen` and `nama`; optional fields are `nidn`, `program_studi_id` (homebase), and `is_active` (default true). Both accept optional nullable `user_id`. PATCH accepts individual fields and rejects empty changes; null explicitly clears nullable fields. Responses use Drizzle camelCase properties and include compact related program data; Mahasiswa also includes faculty and curriculum.

Identifiers are trimmed and uppercased, preserving leading zeros; names are trimmed. NIM, lecturer code, supplied NIDN, and account links have friendly duplicate errors (409). Required blank text and blank optional NIDN are rejected; use null for absent NIDN. New academic assignments require an existing active program and, for students, an existing active curriculum in that program. Unchanged historical inactive assignments can still be edited. Lecturer homebase does not constrain teaching programs.

Writes validate references inside transactions. Account linking locks the user row, checks MAHASISWA/DOSEN role compatibility, and checks both profile tables to prevent duplicate or cross-table links. Profiles can exist without accounts. No credentials are returned and these modules do not change `users.is_active`: CUTI, NONAKTIF, and LULUS students can still log in when their account is active.

Program/curriculum changes require academic review. The form explains the restriction; the service rejects reassignment when an approved KRS or retained approval timestamp exists, including cancelled approved plans. A transfer/history workflow is outside this release. Status changes preserve profiles and teaching history.

The pages reuse pagination and status components and provide a shared profile table/form, server-side filters, edit forms, and a lecturer activation confirmation. Program and curriculum choices have separate paginated searches; search the choices before filling the form. `GET /mahasiswa/kurikulum-options` provides a protected read-only curriculum selector with `page`, `limit`, `search`, `program_studi_id`, and `is_active`. This is not a curriculum management module. Account linking currently uses a UUID field; account provisioning/search is outside scope.

`bun test` includes 24 isolated profile API tests, including role permissions, account compatibility, academic validation, duplicates, updates, filtering/pagination, retained history, and login independence. Run the real PostgreSQL test with temporary fixtures that are fully rolled back:

```powershell
$env:RUN_PROFILE_DB_TESTS = '1'
bun --env-file=packages/db/.env test apps/api/src/modules/academic-profiles.integration.test.ts
Remove-Item Env:RUN_PROFILE_DB_TESTS
```

With `bun dev` running and the development seed present, verify server-rendered lists, edit forms, search, validation feedback, and cross-origin rejection without changing academic records:

```powershell
$env:RUN_PROFILE_E2E = '1'
bun --env-file=packages/db/.env test apps/web/src/lib/server/academic-profiles-flow.test.ts
Remove-Item Env:RUN_PROFILE_E2E
```

The E2E test defaults to `http://localhost:5173`; `PROFILE_WEB_ORIGIN` can point at another local test port. No database schema, migration, or seed changes are required.

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

## Mata Kuliah and Kurikulum master data

ADMIN and AKADEMIK share `/akademik/mata-kuliah`, `/akademik/kurikulum`, and `/akademik/kurikulum/:id`. Both sidebars link to the catalog pages. The detail page manages curriculum course membership, recommended semester, and Wajib/Pilihan. Lists and program/course selectors use server-side pagination and search through Eden Treaty. Status changes and membership removal require confirmation in the UI; backend validation remains authoritative.

The API exposes:

- `GET /mata-kuliah`, `GET /mata-kuliah/:id`, `POST /mata-kuliah`, `PATCH /mata-kuliah/:id`.
- `GET /kurikulum`, `GET /kurikulum/:id`, `POST /kurikulum`, `PATCH /kurikulum/:id`.
- `GET /kurikulum/:id/mata-kuliah`, `POST /kurikulum/:id/mata-kuliah`.
- `PATCH /kurikulum/:id/mata-kuliah/:membershipId`, `DELETE /kurikulum/:id/mata-kuliah/:membershipId`.

All endpoints require an active ADMIN/AKADEMIK account. Writes require the configured web origin. There are no course or curriculum DELETE endpoints. List queries accept `page`, `limit` (maximum 100), literal case-insensitive code/name `search`, and `is_active`. Curriculum lists additionally accept `program_studi_id` and `tahun_berlaku`; membership lists apply search/status to the related course. Curriculum responses include compact Program Studi information; membership responses join catalog code, name, and SKS without duplicating stored data.

Course creation requires `kode`, `nama`, and `sks`; curriculum creation requires `kode`, `nama`, `program_studi_id`, and `tahun_berlaku`. Optional `is_active` defaults to true. Codes are trimmed and uppercased; names are trimmed and must be nonblank. SKS is an integer from 1 to 32767 (the positive PostgreSQL smallint range). Curriculum years range from 1900 to 9999. Codes are unique globally for courses and within a program for curricula. PATCH accepts individual fields and rejects empty changes.

Membership creation requires `mata_kuliah_id`; optional `semester_rekomendasi` defaults to null (unspecified) and `is_wajib` defaults to true. Recommendations must be null or integers from 1 to 32767. PATCH allows only recommendation and Wajib/Pilihan changes, not reassignment to another course. A membership ID is always scoped to its curriculum. Duplicate membership returns 409.

Historical safeguards:

- Course code, name, and SKS cannot change while any curriculum membership or offering references the course. This deliberately protects even unassigned curriculum setup; correct an unused setup by safely removing its memberships first, or create a distinct catalog version. Status and unchanged normalized identity fields remain writable.
- New curricula and changed program assignments require an active program. Reactivation also requires an active program; unchanged inactive historical assignments can still be edited or deactivated.
- Any assigned student, including LULUS or NONAKTIF, freezes curriculum identity, membership additions/removals, and requirement changes. Use a new curriculum version for substantive changes. Deactivation retains students and memberships, and multiple versions may remain active.
- Offering history for a member course in the curriculum's program also blocks curriculum identity changes and removal of that membership. The initial model does not track which curriculum justified an offering, so removal conservatively retains membership even if another curriculum contains the same course.
- New membership requires an active curriculum and an active course. Existing inactive courses remain visible and retain references.

Writes check references/history inside transactions. Curriculum mutations and membership writes lock the parent curriculum against student assignment (which already takes a shared curriculum lock). Membership addition locks the course against concurrent identity changes or deactivation. Program references use shared locks against deactivation. Course updates lock the course before inspecting references. List data/count queries share a repeatable-read snapshot. Future offering services must coordinate their curriculum eligibility reads with these curriculum locks; no offering workflow is implemented here.

Verification:

```sh
bun test
bun run check
bun run build
RUN_CATALOG_DB_TESTS=1 bun --env-file=packages/db/.env test apps/api/src/modules/course-catalog.integration.test.ts
```

The 17 isolated API tests cover CRUD/status behavior, validation, duplicates, pagination/filtering, authorization/origin/session checks, curriculum-scoped membership IDs, and historical restrictions. The opt-in PostgreSQL test exercises real repositories and constraints with temporary fixtures, including an assigned graduated student and an offering, and rolls back every fixture.

With the API and frontend running against the existing development seed:

```sh
RUN_CATALOG_E2E=1 bun --env-file=packages/db/.env test apps/web/src/lib/server/course-catalog-flow.test.ts
```

`CATALOG_WEB_ORIGIN` can select another local web port. This test verifies server-rendered lists, edit forms, curriculum details, search, form validation, and cross-origin rejection without changing academic records. Browser interaction automation is not included. No schema, migrations, or seed data changes are required.

## Semester, Kelas Kuliah, and Kelas Dosen

ADMIN and AKADEMIK share `/akademik/semester`, `/akademik/kelas-kuliah`, and `/akademik/kelas-kuliah/:id`. Both sidebars link to the new lists. The pages use Eden Treaty, server-side filters/pagination, paginated reference searches, create/edit forms, explicit semester activation confirmation, and lecturer/coordinator management. Semester activation means selecting the academic term; it is separate from master-data availability flags.

Endpoints (all require an active ADMIN/AKADEMIK account; writes also require the configured web origin):

- `GET /semester`, `GET /semester/:id`, `POST /semester`, `PATCH /semester/:id`.
- `GET /kelas-kuliah`, `GET /kelas-kuliah/:id`, `POST /kelas-kuliah`, `PATCH /kelas-kuliah/:id`.
- `GET /kelas-kuliah/:id/dosen`, `POST /kelas-kuliah/:id/dosen`.
- `PATCH /kelas-kuliah/:id/dosen/:assignmentId`, `DELETE /kelas-kuliah/:id/dosen/:assignmentId`.

Request fields use the documented snake_case names; responses use inferred Drizzle camelCase fields. Lists accept `page`, `limit` (maximum 100), and literal case-insensitive `search`. Semester additionally filters by `jenis`, `tahun_mulai`, and `is_active=true|false`. Classes filter by `semester_id`, `program_studi_id`, `mata_kuliah_id`, and `status`; search covers course code/name and class name. Class lists batch lecturer joins rather than querying once per class. Detail responses include `jumlahMahasiswa`, derived only from AKTIF details on DISETUJUI KRS, and `jumlahJadwal`. Neither value is stored.

Semester rules:

- GANJIL/GENAP, years 1900–9998, canonical YYYY1/YYYY2 codes, valid calendar dates, and ordered date ranges are validated. Both documented unique constraints remain authoritative.
- `PATCH /semester/:id` with `{ "is_active": true }` switches the active term in one transaction. Creation may also explicitly activate a term. A failed write restores the previously active term. `{ "is_active": false }` permits zero active terms. Dates never activate terms automatically.
- Writes use SERIALIZABLE transactions with up to three total attempts for serialization/deadlock conflicts. A transaction-scoped advisory lock serializes active-term switches even when no semester is active yet.
- Identity and date changes are conservatively rejected when approved KRS (including retained approval timestamps after cancellation) or schedules exist. Unchanged identity fields and active-term changes remain allowed. No semester DELETE endpoint exists.

Class and lecturer rules:

- New offerings require an existing semester and active program/course. Class labels are trimmed/uppercased, capacity is a positive PostgreSQL integer, and the documented four-part class identity is unique. DRAFT is the default. Curriculum membership is an opening requirement, so an otherwise valid DRAFT can be prepared before membership exists.
- Semester/course/program changes are rejected after any KRS selection, including cancelled selections, or when a schedule exists. Capacity cannot be reduced below approved active enrollment count or increased beyond an assigned room's capacity.
- DITUTUP retains enrollments. Cancelling a class with active details is rejected until a KRS cancellation workflow can cancel those details transactionally. A cancelled scheduled class cannot be restored without schedule conflict validation. No class DELETE endpoint exists.
- Opening checks program/course availability, offering-program curriculum membership, and an active lecturer. It rejects missing schedules. Even preexisting schedules cannot authorize a new DIBUKA transition until the future Jadwal module supplies complete conflict validation. Existing seeded DIBUKA classes remain readable/editable for safe changes.
- Adding lecturers to scheduled classes is also guarded until Jadwal conflict validation exists. Coordinator-only edits are safe because they do not change participating lecturers or slots. Removing a lecturer releases their reserved time and preserves at least one active lecturer on an opened class.
- Lecturer assignments require an active lecturer and reject duplicates. Homebase does not limit teaching programs. At most one coordinator is allowed, and no coordinator is required. To change coordinators, clear the previous flag before assigning the new one; each operation locks the class. Assignment IDs are always scoped to the parent class.
- Class/assignment writes use SERIALIZABLE transactions with bounded retries and lock the parent class. Program/course/semester references use shared locks. Opening eligibility takes shared curriculum locks compatible with existing membership/history guards. Future Jadwal/KRS operations must participate in the documented class-lock and serializable transaction protocols.

Verification:

```sh
bun test
bun run check
bun run build
RUN_OFFERING_DB_TESTS=1 bun --env-file=packages/db/.env test apps/api/src/modules/academic-offerings.integration.test.ts
RUN_OFFERING_E2E=1 bun --env-file=packages/db/.env test apps/web/src/lib/server/academic-offerings-flow.test.ts
```

The 16 isolated API/service tests cover CRUD, filtering/pagination, duplicates, validation, active-term replacement/rollback, history, opening safeguards, lecturer/coordinator rules, authorization, and bounded transaction retries. The PostgreSQL integration test exercises real repositories, constraints, and academic-history fixtures; all fixtures and active-semester changes roll back. The rendered-page test requires running API/frontend servers and the existing development seed, and submits only invalid/rejected forms. `OFFERING_WEB_ORIGIN` selects a different local frontend port. Browser interaction automation is not included.

No schemas, migrations, or development seed records are changed. Jadwal, KRS workflows, attendance, and grading remain outside this increment.
