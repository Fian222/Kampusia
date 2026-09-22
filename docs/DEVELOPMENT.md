# Kampusia development

## Running the application

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env`. These local files are Git-ignored. Set the API's `DATABASE_URL` to the migrated local database, `WEB_URL=http://localhost:5173`, and `NODE_ENV=development`. The web server uses the private `API_URL=http://localhost:3000` to contact the API through Eden Treaty.

Run `bun dev` from the repository root, then open http://localhost:5173/login. PostgreSQL must be running, migrations applied, and the development seed present to use the demo accounts below. See [authentication notes](AUTHENTICATION.md) for session behavior and deployment configuration.

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

| Role | Nomor Induk | Password |
| --- | --- | --- |
| ADMIN | `99000001` | value of `SEED_PASSWORD` |
| AKADEMIK | `99000002` | value of `SEED_PASSWORD` |
| DOSEN | `99000003` | value of `SEED_PASSWORD` |
| MAHASISWA | `99202601` | value of `SEED_PASSWORD` |

Use these credentials only for development. All roles sign in through `/login` with Nomor Induk; email is optional contact/recovery metadata and is not accepted as a credential. For MAHASISWA, Nomor Induk is the linked profile's NIM. For DOSEN, it is the internal campus employee NIK stored on the linked profile. For ADMIN and AKADEMIK, it is the staff NIK stored directly in `users.login_id`. In this project, NIK means an internal employee number—not the national KTP NIK. Successful login routes ADMIN to `/admin`, AKADEMIK to `/akademik`, DOSEN to `/dosen`, and MAHASISWA to `/mahasiswa`. The database stores a separate salted Argon2id hash produced by Bun for each account, never the plaintext password. A different `SEED_PASSWORD` can be chosen for the first run. Reruns preserve existing hashes and do not reset credentials, even if the environment value later changes.

The DOSEN account is linked only to Rina Pratama (Demo), NIK `99000003` and code `DEV-DOS-1`, who is already assigned to seeded classes. The MAHASISWA account is linked only to Andi Saputra (Demo), NIM `99202601`, whose approved 9-SKS KRS includes Basis Data, Pemrograman Web, and Struktur Data. The current fixture does not create meetings, attendance rows, grading components, scores, or finalized study results, so attendance and KHS/IPS/IPK remain empty until those workflows are exercised.

## Authentication verification

`bun test` includes isolated API tests for Nomor Induk login, leading zeroes, rejected email/non-digit input, null or unknown identifiers, invalid credentials, inactive accounts, cookies, logout/revocation, current user, session expiry, and all four roles. These tests use an in-memory repository and do not modify PostgreSQL.

For the opt-in HTTP integration test, keep `bun dev` running with the local database and existing seed, then run this in a second PowerShell terminal from the repository root:

```powershell
$env:RUN_AUTH_E2E = '1'
bun --env-file=packages/db/.env test apps/web/src/lib/server/auth-flow.test.ts
Remove-Item Env:RUN_AUTH_E2E
```

The test reads `SEED_PASSWORD`, signs in all four accounts through the shared SvelteKit form action, checks each role's redirect, rendered dashboard, and role restriction, then signs out. It creates only temporary API sessions and does not change the database. It is skipped during ordinary test runs.

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

Each resource exposes `GET /resource`, `GET /resource/:id`, `POST /resource`, and `PATCH /resource/:id`, where resource is `mahasiswa` or `dosen`. There are no DELETE endpoints. Lists use the same `page`, `limit` (maximum 100), and literal case-insensitive `search` conventions as Fakultas/Program Studi. Mahasiswa searches NIM/name and accepts `program_studi_id`, `kurikulum_id`, `angkatan`, and `status`. Dosen searches NIK/code/NIDN/name and accepts `program_studi_id` and `is_active=true|false`. SQL handles filtering, counting, ordering, and pagination; list/count use a consistent transaction snapshot.

Mahasiswa creation requires `nim`, `nama`, `program_studi_id`, `kurikulum_id`, and integer `angkatan` between 1900 and 9999. Optional `status` defaults to AKTIF; valid values are AKTIF, CUTI, LULUS, KELUAR, NONAKTIF. Dosen requires `kode_dosen` and `nama`; optional fields are `nik`, `nidn`, `program_studi_id` (homebase), and `is_active` (default true). Profile requests do not accept `user_id`. PATCH accepts individual academic/personnel fields and rejects empty changes; null explicitly clears nullable fields except a linked DOSEN's NIK. Responses omit the internal account UUID and include only safe, read-only linked-account identity/status plus compact related program data; Mahasiswa also includes faculty and curriculum.

NIM and NIK are trimmed digit strings of at most 30 characters and preserve leading zeroes; they are never parsed as JavaScript numbers. Ordinary codes and NIDN are trimmed and uppercased, and names are trimmed. NIM, NIK, lecturer code, supplied NIDN, login identity, and account links have friendly duplicate errors (409). Required blank text and blank optional NIDN are rejected; use null for absent optional values. New academic assignments require an existing active program and, for students, an existing active curriculum in that program. Unchanged historical inactive assignments can still be edited. Lecturer homebase does not constrain teaching programs.

Writes validate references inside transactions. For an unlinked profile, the service looks up only the exact NIM/NIK in `users.login_id`, locks the matching row, checks MAHASISWA/DOSEN role compatibility, and checks both profile tables before linking automatically. It never matches by email, name, lecturer code, or NIDN. No matching users row leaves the profile valid and unlinked; a conflicting role or existing link rejects and rolls back the write. Existing links are revalidated and preserved. Changing a linked NIM/NIK updates the profile and `users.login_id` atomically; a collision rolls back both. Ordinary profile editing cannot manually link or unlink accounts. No credentials are returned and these modules do not change `users.is_active`: CUTI, NONAKTIF, and LULUS students can still log in when their account is active.

Program/curriculum changes require academic review. The form explains the restriction; the service rejects reassignment when an approved KRS or retained approval timestamp exists, including cancelled approved plans. A transfer/history workflow is outside this release. Status changes preserve profiles and teaching history.

The pages reuse pagination and status components and provide a shared profile table/form, server-side filters, edit forms, and a lecturer activation confirmation. Program and curriculum choices have separate paginated searches; search the choices before filling the form. `GET /mahasiswa/kurikulum-options` provides a protected read-only curriculum selector with `page`, `limit`, `search`, `program_studi_id`, and `is_active`. The obsolete profile account-option routes remain removed. Profile forms show an **Akun Login** section with the deterministic Nomor Induk and activation status. They never expose or submit the users UUID.

ADMIN and AKADEMIK can use `POST /mahasiswa/:id/account` or `POST /dosen/:id/account` to provision an unlinked profile, and the corresponding `/account/reset` endpoint to reset a linked account. New accounts use NIM/NIK exactly, the matching academic role, active status, and `must_change_password = true`. Creation and linking are one transaction. An exact compatible existing unlinked account is linked without resetting its password; all other collisions are rejected. Reset retains account/profile identity and contact fields, replaces only the Argon2id hash, and sets the flag. Existing sessions become invalid because session validation fingerprints the current hash.

Temporary passwords come from the platform cryptographic RNG and are returned only by the successful mutation that generated them. The confirmation modal shows the value once and supports an explicit clipboard action; closing it clears the plaintext from component state. No GET response, URL, browser storage, audit text, or log retains the plaintext. A temporary-password login is restricted to `/change-password`, logout, and the current-session check. A successful 12+-character password replacement clears the flag, rotates the current session, and redirects to the role dashboard.

`bun test` includes isolated profile API tests for role permissions, automatic exact-identifier account resolution, incompatible and cross-profile rejection, no-account preservation, UUID omission, atomic identity synchronization, rejection of manual `user_id`, academic validation, duplicates, updates, filtering/pagination, retained history, and login independence. Run the real PostgreSQL test with temporary fixtures that are fully rolled back:

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

The fixture includes Fakultas Teknik (`DEV-FT`), Informatika S1 (`DEV-IF`), Kurikulum Informatika 2026, five 3-SKS courses, two demo lecturers, five AKTIF students (`99202601` through `99202605`), and three rooms. NIDNs are left null. Curriculum semester recommendations are 1 for Algoritma dan Pemrograman, 3 for Basis Data and Struktur Data, and 5 for Pemrograman Web and Sistem Operasi. Recommendations do not restrict KRS eligibility in the initial design.

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

The seed uses fixed fixture UUIDs and development-prefixed business identifiers. The original AKADEMIK fixture account identifies the academic fixture. On an existing pre-demo-login fixture, missing ADMIN, DOSEN, and MAHASISWA accounts are added and the two selected profiles are linked without rewriting existing profile timestamps. On later reruns, all fixture records are checked and retained rather than reinserted. Existing password hashes and timestamps are preserved, except timestamps on an explicitly changed active-semester flag. Existing academic fixture edits, incompatible account/profile links, partial fixtures, or business identifiers owned by different UUIDs cause an error and full rollback; the seed does not reset or take over those records.

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

The live test runs the seed twice, compares fingerprints of all application tables (including UUIDs, timestamps, and stored password hashes), verifies `SEED_PASSWORD` for all four roles, checks the DOSEN and MAHASISWA profile links, checks curriculum integrity and validated foreign keys, and checks the expected enrollment counts. It is intended for this unmodified demo fixture. It does not delete or reset data.

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

Writes check references/history inside transactions. Curriculum mutations and membership writes lock the parent curriculum against student assignment (which already takes a shared curriculum lock). Membership addition locks the course against concurrent identity changes or deactivation. Program references use shared locks against deactivation. Course updates lock the course before inspecting references. List data/count queries share a repeatable-read snapshot. Offering services coordinate curriculum eligibility reads with these curriculum locks.

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

- `GET /semester`, `GET /semester/:id`, `POST /semester`, `PATCH /semester/:id`, `PATCH /semester/:id/krs-period`.
- `GET /kelas-kuliah`, `GET /kelas-kuliah/:id`, `POST /kelas-kuliah`, `PATCH /kelas-kuliah/:id`.
- `GET /kelas-kuliah/:id/dosen`, `POST /kelas-kuliah/:id/dosen`.
- `PATCH /kelas-kuliah/:id/dosen/:assignmentId`, `DELETE /kelas-kuliah/:id/dosen/:assignmentId`.

Request fields use the documented snake_case names; responses use inferred Drizzle camelCase fields. Lists accept `page`, `limit` (maximum 100), and literal case-insensitive `search`. Semester additionally filters by `jenis`, `tahun_mulai`, and `is_active=true|false`. Classes filter by `semester_id`, `program_studi_id`, `mata_kuliah_id`, and `status`; search covers course code/name and class name. Class lists batch lecturer joins rather than querying once per class. Detail responses include `jumlahMahasiswa`, derived only from AKTIF details on DISETUJUI KRS, and `jumlahJadwal`. Neither value is stored.

Semester rules:

- GANJIL/GENAP, years 1900–9998, canonical YYYY1/YYYY2 codes, valid calendar dates, and ordered date ranges are validated. Both documented unique constraints remain authoritative.
- `PATCH /semester/:id` with `{ "is_active": true }` switches the active term in one transaction. Creation may also explicitly activate a term. A failed write restores the previously active term. `{ "is_active": false }` permits zero active terms. Dates never activate terms automatically.
- `PATCH /semester/:id/krs-period` changes or clears only the paired KRS opening/closing instants. The Semester page exposes this through a dedicated **Atur Periode KRS** modal so historical identity and calendar fields are not resubmitted when configuring the workflow window.
- Writes use SERIALIZABLE transactions with up to three total attempts for serialization/deadlock conflicts. A transaction-scoped advisory lock serializes active-term switches even when no semester is active yet.
- Identity and date changes are conservatively rejected when approved KRS (including retained approval timestamps after cancellation) or schedules exist. Unchanged identity fields and active-term changes remain allowed. No semester DELETE endpoint exists.

Class and lecturer rules:

- New offerings require an existing semester and active program/course. Class labels are trimmed/uppercased, capacity is a positive PostgreSQL integer, and the documented four-part class identity is unique. DRAFT is the default. Curriculum membership is an opening requirement, so an otherwise valid DRAFT can be prepared before membership exists.
- Semester/course/program changes are rejected after any KRS selection, including cancelled selections, or when a schedule exists. Capacity cannot be reduced below approved active enrollment count or increased beyond an assigned room's capacity.
- DITUTUP retains enrollments. Cancelling a class with active details is rejected until a KRS cancellation workflow can cancel those details transactionally. A cancelled scheduled class cannot be restored without schedule conflict validation. No class DELETE endpoint exists.
- Opening checks program/course availability, offering-program curriculum membership, an active lecturer, and at least one valid, conflict-free schedule. The Jadwal validator runs within the existing class transaction, including when restoring a cancelled class. Existing seeded DIBUKA classes remain readable/editable for safe changes.
- Adding lecturers to scheduled classes revalidates schedules with the proposed lecturer in the same transaction. Coordinator-only edits are safe because they do not change participating lecturers or slots. Removing a lecturer releases their reserved time and preserves at least one active lecturer on an opened class.
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

No schemas, migrations, or development seed records are changed. KRS workflows, attendance, and grading remain outside this increment.


## Jadwal Kuliah and Ruangan

ADMIN and AKADEMIK manage schedules on `/akademik/kelas-kuliah/:id` and rooms on `/akademik/ruangan`. Both roles have a Ruangan sidebar link. The class detail includes weekday, local start/end times, room, building, add/edit forms, removal confirmation, and a confirmed status-change form. Paginated room searches provide room choices; the current room remains visible when outside the selector page. Failed forms preserve input and display API validation messages. All requests use Eden Treaty and the existing server-side role/session/origin checks.

Endpoints:

- `GET /kelas-kuliah/:id/jadwal`, `POST /kelas-kuliah/:id/jadwal`.
- `PATCH /kelas-kuliah/:id/jadwal/:jadwalId`, `DELETE /kelas-kuliah/:id/jadwal/:jadwalId`.
- `GET /ruangan`, `GET /ruangan/:id`, `POST /ruangan`, `PATCH /ruangan/:id`.
- Class status continues to use `PATCH /kelas-kuliah/:id`; there is no separate status implementation.

Schedule bodies use `ruangan_id`, `hari` (1 = Monday through 7 = Sunday), `jam_mulai`, and `jam_selesai`. The class comes from the path. PATCH accepts individual fields and rejects empty changes. Times accept `HH:mm` or `HH:mm:ss` with optional fractional seconds (up to six digits), in Asia/Jakarta. The start must precede the end within the same day. A slot must occur at least once within the class's semester dates. Rooms must exist, be active, and accommodate the class capacity. Schedule IDs are always scoped to their parent class. Lists accept `page` and `limit` (maximum 100), with weekday/time ordering and a repeatable-read data/count snapshot.

Conflict validation requires the same weekday, an actual shared occurrence within the intersection of semester date ranges, and strict interval overlap. Adjacent slots are valid. DRAFT, DIBUKA, and DITUTUP reserve resources; DIBATALKAN does not. Conflicts cover the room, the class itself, every assigned lecturer, and other classes of students with approved active KRS selections. Semester and lecturer information are derived through the class. Restoring a cancelled class checks its own retained slots as well as other classes. Adding lecturers to scheduled classes now validates the proposed assignment instead of blocking all additions.

Schedule writes, lecturer assignments, class opening/restoration, and room changes use SERIALIZABLE transactions with at most three total attempts for serialization/deadlock failures. All conflict reads run inside the transaction. Schedule/assignment writes lock the parent class; scheduling reads take shared locks on its semester and room. Room updates lock the room before checking schedules. Existing semester-history guards continue to reject date changes when schedules exist. Existing class-capacity and enrollment-history guards remain authoritative.

Room requests use `kode`, `nama`, optional nullable `gedung`, positive integer `kapasitas`, and optional `is_active` (default true). Codes are trimmed, uppercased, and unique. Lists support literal case-insensitive code/name search, `is_active=true|false`, and pagination. PATCH handles activation/deactivation; no hard-delete endpoint exists. Capacity reductions must accommodate every referenced class, including historical schedules. Deactivation requires resolving all current/future occurrences on noncancelled classes; campus-local date/time determines those occurrences. Past and cancelled schedules retain their references.

Opening a class now succeeds after active program/course, offering-program curriculum membership, active lecturer, and valid conflict-free schedule checks pass. Missing prerequisites produce specific messages. DITUTUP preserves enrollments. Cancellation with active KRS details remains rejected until the KRS cancellation workflow exists. Removing the last schedule of an opened class is rejected, and schedule deletion is conservatively prohibited for a class with retained KRS approval history. Schedule edits remain possible after validation against approved students' other classes.

Verification:

```sh
bun test
bun run check
bun run build
RUN_SCHEDULING_DB_TESTS=1 bun --env-file=packages/db/.env test apps/api/src/modules/scheduling.integration.test.ts
RUN_SCHEDULING_E2E=1 bun --env-file=packages/db/.env test apps/web/src/lib/server/scheduling-flow.test.ts
```

The 22 isolated scheduling tests cover CRUD, scoping, validation, resource/student conflicts, weekday boundaries, cross-semester overlaps, adjacency, cancelled-class restoration, room safety/history, role/session/origin checks, and bounded retries. Existing opening/lecturer tests now exercise the completed behavior. PostgreSQL integration covers real queries, opening, invalid schedules, assignment conflicts, approved student plans, room safety, rollback, and forced concurrent room/lecturer schedule races. The race test uses independent transactions and precisely removes its own committed fixture IDs in `finally`; other fixtures roll back. Rendered-page tests require the development seed and running servers, submit only invalid/unconfirmed changes, and support `SCHEDULING_WEB_ORIGIN` for an alternate local port. Browser interaction automation is not included.

No database schemas, migrations, or seed records are changed. KRS workflows, attendance, grades, and production deployment configuration remain outside this task.

## KRS

The initial advising workflow currently uses the same Semester KRS interval for both student changes and ordinary Dosen PA review. There is no separate adviser-review deadline or grace period yet; ADMIN/AKADEMIK must deliberately extend the Semester interval when institutional processing needs more time. Administrative cancellation remains the documented exception and may occur outside that interval.

Semester `datetime-local` values are always interpreted as Asia/Jakarta academic time and converted explicitly to absolute `timestamptz` instants; they never depend on the API host timezone. The development seed assigns the demo MAHASISWA to the linked demo DOSEN and refreshes the active demo Semester to a rolling, currently usable KRS window on every safe idempotent seed run. This rolling window is development-only fixture behavior, not production scheduling policy.

Students use `/mahasiswa/krs`; ADMIN and AKADEMIK share `/akademik/krs` and `/akademik/krs/:id`. The sidebar links to the appropriate area. Student accounts must be linked to their academic profiles; the development seed provisions the documented MAHASISWA demo account and links it to `99202601`.

Set `KRS_INITIAL_BATAS_SKS` in `apps/api/.env` to the authorized fallback credit limit, for example `18` for development. The service validates it as a positive PostgreSQL smallint whenever a new plan needs the fallback. Existing plans retain `krs.batas_sks`, and neither student request bodies nor subsequent configuration changes overwrite it. Missing/invalid fallback configuration returns a clear service-unavailable message only when a new plan cannot use a complete previous-semester IPS. There is no credit-limit edit endpoint.

New KRS creation resolves the most recent valid academic semester before the target by the documented `tahun_mulai` and GANJIL/GENAP sequence. A candidate must be a different semester, occupy an earlier academic position, and end before the target starts; UUID order and ID arithmetic are never used. For a GANJIL target, the latest earlier academic year is considered. For a GENAP target, GANJIL in the same academic year may be considered first. Missing academic periods are not invented: the latest stored valid predecessor is used, or creation falls back when none exists.

The predecessor is usable only when it has at least one finalized `hasil_studi` row for the student and no unfinished course under the existing KHS semantics. IPS is calculated with the shared `academic-result.ts` utility from immutable `hasil_studi.nilai_indeks` snapshots and `mata_kuliah.sks`; current numeric-to-letter/index grading rules are not consulted. A non-null IPS is rounded with the same deterministic two-decimal round-half-up behavior exposed by KHS.

The isolated `credit-limit-policy.ts` module currently contains this replaceable Kampusia development/default mapping:

| Previous IPS minimum | Maximum SKS |
| ---: | ---: |
| 3.00 | 24 |
| 2.50 | 21 |
| 2.00 | 18 |
| 1.50 | 15 |
| 0.00 | 12 |

This mapping is not an official or universal university policy. Decimal comparison uses exact hundredths rather than binary floating point. The institution's validated ranges can replace this single module later. `KRS_INITIAL_BATAS_SKS` remains the fallback when there is no predecessor, no finalized result, or an unfinished previous-semester result prevents a complete IPS.

The selected limit is written once to `krs.batas_sks` in the same retryable SERIALIZABLE creation transaction. Concurrent creation remains arbitrated by the unique mahasiswa/semester constraint; a losing request reads the winning existing DRAFT. Grade corrections, IPS changes, policy/configuration changes, rejection reopening, and administrative reopening do not recalculate the stored snapshot. Student input cannot supply `batas_sks`. The creation API response temporarily identifies `PREVIOUS_IPS`, `INITIAL_FALLBACK`, or `EXISTING_SNAPSHOT`; this source is not persisted and later reads do not guess it.

Student endpoints (authenticated MAHASISWA):

- `GET /mahasiswa/me/krs`: paginated own history plus the explicitly configured active semester.
- `GET /mahasiswa/me/krs/:semesterId`: semester information, compact current Dosen PA context, and own KRS, or `krs: null` when none exists. The adviser context lets the course-selection header remain accurate before the DRAFT is created.
- `POST /mahasiswa/me/krs/:semesterId`: create/get DRAFT; other existing states require their documented transitions and cannot be recreated.
- `GET /mahasiswa/me/krs/:semesterId/kelas`: paginated eligible class search, excluding already selected courses.
- `POST /mahasiswa/me/krs/:krsId/kelas`: add a selection with `{ "kelas_kuliah_id": "UUID" }`.
- `DELETE /mahasiswa/me/krs/:krsId/kelas/:detailId`: cancel a DRAFT selection, retaining its row.
- `POST /mahasiswa/me/krs/:krsId/clear`: **Kosongkan KRS** by cancelling every active detail while retaining the DRAFT parent, rows, and `batas_sks`.
- `POST /mahasiswa/me/krs/:krsId/submit`, `POST /mahasiswa/me/krs/:krsId/reopen`.

Dosen PA endpoints (authenticated DOSEN linked to an active lecturer profile) are `GET /dosen/me/krs`, `GET /dosen/me/krs/:id`, and `POST /dosen/me/krs/:id/approve|reject|reopen`. The default list is the submitted queue, with status/search/pagination filters. Repository predicates and service authorization both scope every read and action to `mahasiswa.dosen_pa_id = authenticated dosen.id`; another adviser's KRS is returned as not found.

Administrative endpoints (authenticated ADMIN/AKADEMIK):

- `GET /krs`: pagination, literal NIM/name `search`, `semester_id`, `program_studi_id`, and `status` filters.
- `GET /krs/:id`: student, program, semester, dynamically calculated SKS, retained selections, courses, lecturers, schedules, rooms, and effective enrollment counts.
- `POST /krs/:id/approve`, `/reject`, `/cancel`, `/reopen`.

Approve, reopen, submit, and clear use an empty JSON object (`{}`). Reject requires `{ "alasan": "..." }`; administrative cancellation requires the same nonblank reason shape. All list endpoints use the existing page/limit convention (default 20, maximum 100). API responses follow the existing success/data/meta format with Indonesian domain errors. Every mutation requires the configured web origin and active role/account checks.

The implemented lifecycle is DRAFT → DIAJUKAN → DISETUJUI or DITOLAK; students can reopen DITOLAK → DRAFT while retaining the last rejection metadata. The current Dosen PA or ADMIN/AKADEMIK can reopen DISETUJUI → DRAFT during the open KRS interval, recording the reopen actor/time, retaining approval history and active detail rows, and immediately releasing effective seats through the parent status. Administrative cancellation moves any nonterminal plan to DIBATALKAN outside or inside the interval, requires a reason, cancels active details atomically, and retains prior workflow metadata. Cancelled plans are terminal. No KRS or detail is hard-deleted.

New plans, edits, clear, submission, student correction, and ordinary Dosen PA/admin review require an AKTIF student, the explicitly active semester, and `krs_mulai_at <= now < krs_selesai_at`. Submission additionally requires a current active Dosen PA linked to an active DOSEN account. Existing program/faculty, DIBUKA-class, active-course, curriculum, lecturer, schedule/room, finalized-grade, duplicate-course, SKS, and schedule-conflict validations remain authoritative. Approval repeats all validations and checks capacity under locks. Administrative cancellation remains possible for historical or otherwise ineligible plans.

All KRS operations use SERIALIZABLE transactions with the existing bounded retry utility (three attempts). Mutations lock the parent KRS and relevant class rows in UUID order. Approval counts only AKTIF details on DISETUJUI parents after acquiring the class locks; pending plans consume no seats. A full class rolls back the entire approval. Cancellation and reopening participate in the same class-lock protocol. Concurrent initial creation uses the student/semester unique constraint and returns the winning draft. Class details already expose derived enrollment counts; KRS class lists also return counts and remaining capacity, including zero for empty classes. Full classes remain selectable, but approval requires capacity.

The student page shows the active Semester, Jakarta KRS interval/state, Dosen PA, maximum/selected/remaining SKS, searchable classes, workflow metadata, rejection reason, **Kosongkan KRS**, correction, and read-only closed-period states. `/dosen/krs` is the adviser work queue with own-advisee search/status filters, detail, previous IPS, schedule/capacity context, approve/reject, and approved-plan reopening. The administrative page remains global oversight and labels normal review actions as overrides; its terminal action is explicitly **Batalkan Administratif**. The Mahasiswa modal has a paginated active-Dosen selector, and the Semester modal has nullable paired WIB `datetime-local` fields plus the four derived period states.

Verification:

```sh
bun test
bun run check
bun run build
RUN_KRS_DB_TESTS=1 bun --env-file=packages/db/.env test apps/api/src/modules/krs/krs.integration.test.ts
RUN_KRS_E2E=1 bun --env-file=packages/db/.env test apps/api/src/modules/krs/krs-flow.test.ts
```

The isolated KRS tests cover lifecycle, timestamps, ownership, role/CSRF checks, eligibility, duplicates, SKS, schedules, reactivation, immutability, capacity release, previous-semester selection, IPS snapshot reuse, every development-policy boundary, fallback behavior, and non-retroactive limits. PostgreSQL tests exercise real repositories, finalized stored indexes, unfinished-result fallback, filtered queries, uniqueness/timestamp constraints, atomic multi-class approval, effective counts, concurrent final-seat approval with forced overlapping transactions and retries, and concurrent draft creation. Integration fixtures roll back or precisely remove their own committed IDs.

The opt-in rendered-page test requires running API/web servers and `KRS_INITIAL_BATAS_SKS` configured. It creates temporary student/reviewer accounts, submits the student and administrative forms through SvelteKit/Eden across the full lifecycle, checks confirmations and ADMIN access to shared pages, logs out, and removes its fixture IDs. `KRS_WEB_ORIGIN` can select a different local frontend port. It verifies HTTP-rendered pages and form actions; interactive browser automation is not included.

No database schema or migration is changed by this application milestone. The development fixture now supplies the documented adviser assignment and rolling open KRS interval. Course prerequisites and a full append-only workflow ledger remain outside scope. Official institutional IPS-to-SKS ranges are still unresolved; the explicitly labeled development policy is replaceable. KHS/IPS/IPK remain derived from finalized `hasil_studi`, independent of later KRS reopen/cancellation. Individual approved-detail cancellation and automatic class-wide cancellation are not exposed.

## Grading and academic-result database extension

The database package implements the documented `komponen_nilai`, `nilai_mahasiswa`, and `hasil_studi` tables and their Drizzle relations. Additive migration `0002_furry_yellow_claw.sql` creates only those tables, restrictive foreign keys, documented unique constraints and indexes, and row-local CHECK constraints. Scores use exact `numeric(5,2)` values; `nilai_mahasiswa.nilai` is nullable with no default, so missing remains distinct from the valid numeric score zero.

Run the schema contract, migration-history check, and opt-in local PostgreSQL integration test from the repository root:

```sh
bun test packages/db/src/schema.test.ts
bun run db:check
RUN_GRADING_DB_TESTS=1 bun --env-file=packages/db/.env test packages/db/src/grading-schema.integration.test.ts
bun run check
```

PostgreSQL enforces component weight and order ranges, nonblank names, case-insensitive active-name uniqueness per class, score ranges, one score per student/component, one final result per student/class, result numeric and canonical-letter validity, correction metadata consistency, correction time ordering, actor references, and restrictive historical references. The integration fixtures always roll back.

The database deliberately does not enforce cross-row active component weights totaling exactly 100.00, effective approved-enrollment eligibility, authorization, grading lifecycle transitions, full-roster atomic finalization, component freezing, score/result synchronization during correction, numeric-to-letter/index mapping, or rounding. Those rules are implemented by the grading service and its documented SERIALIZABLE transaction protocol below. KHS, IPS, and IPK remain derived from `hasil_studi`; no persistent tables or dynamic KRS credit-limit behavior are added.

## Grading application module

The grading application layer uses the existing Route → Service → Repository → Drizzle structure and the existing authenticated, origin-checked server flow. Normal grading belongs to an active DOSEN assigned through `kelas_dosen`: assigned lecturers configure components and enter or update ordinary scores. ADMIN/AKADEMIK can inspect every class but cannot use ordinary component, score-entry, or finalization mutations. MAHASISWA cannot access the grading workflow.

Normal finalization follows the existing `kelas_dosen.is_koordinator` assignment. When a coordinator is configured, only that assigned coordinator may finalize. When exactly one active assigned DOSEN exists and no coordinator is configured, that lecturer may finalize. Multiple active assigned lecturers without a coordinator receive a clear domain error requiring one to be designated; Kampusia never selects a coordinator implicitly. ADMIN/AKADEMIK retain only the separate, reason-required post-finalization correction path.

Class-scoped endpoints are:

- `GET/POST /kelas-kuliah/:id/komponen-nilai`
- `PATCH/DELETE /kelas-kuliah/:id/komponen-nilai/:componentId`
- `GET /kelas-kuliah/:id/nilai`
- `PUT /kelas-kuliah/:id/nilai/:componentId/mahasiswa/:mahasiswaId`
- `POST /kelas-kuliah/:id/nilai/finalize`
- `POST /kelas-kuliah/:id/nilai/corrections/:mahasiswaId`

Component configuration may temporarily total less or more than 100.00%. The API reports the current exact active total. A scored component cannot be deleted; deactivate it before finalization to retain its scores while excluding it from completeness and calculation. Once any `hasil_studi` exists for the class, all component changes and ordinary score writes are frozen.

The roster includes only effective enrollment (`krs_detail.status = AKTIF` and parent `krs.status = DISETUJUI`). Score rows are lazy. No row or a retained null score is shown as **Belum dinilai**; the explicit numeric score `0.00` is retained and displayed as a valid value. Former-enrollment and inactive-component score rows remain stored as history but do not enter ordinary finalization.

Finalization requires a `DITUTUP` class, at least one effective student, at least one active component, exactly 100.00% total active weight, and an explicit non-null score for every active component and effective student. It locks related KRS rows before the class, then locks configuration, scores, and results in stable order inside a retryable SERIALIZABLE transaction. Every result is calculated before the complete class result set is inserted, and every row shares one finalizer and timestamp. Any failure rolls back the whole class.

Calculations use integer hundredths with `BigInt`, not JavaScript binary floating point. The weighted numerator is summed exactly and rounded once to two decimals using round-half-up. The replaceable Kampusia development/default mapping is:

| Minimum numeric score | Letter | Index |
| ---: | :---: | ---: |
| 85.00 | A | 4.00 |
| 80.00 | A- | 3.70 |
| 75.00 | B+ | 3.30 |
| 70.00 | B | 3.00 |
| 65.00 | B- | 2.70 |
| 60.00 | C+ | 2.30 |
| 55.00 | C | 2.00 |
| 45.00 | D | 1.00 |
| 0.00 | E | 0.00 |

This is a development policy, not a statutory or universal university scale. It lives in `apps/api/src/modules/nilai/grading-policy.ts` so a future validated institutional policy can replace it without scattering thresholds through routes or services. Finalized numeric, letter, and index values remain historical snapshots if the policy later changes.

Post-finalization correction is restricted to ADMIN/AKADEMIK and requires a nonblank reason. One retained active-component score and the existing result snapshot are updated and recalculated atomically under the same policy. The original result id, class/student identity, creation time, finalization time, and finalizer are preserved; only the latest correction metadata is retained. A full revision ledger, manual final-result override, institutional repeat-course replacement policy, and result annulment remain outside this milestone. KHS/IPS/IPK consume the corrected snapshot through the separate read-only module below.

The DOSEN class workspace presents Ringkasan, Pertemuan/Absensi, and Penilaian as first-class sections. Penilaian includes component management, an inline score grid, saved/loading/field-adjacent error feedback, weight and completeness indicators, final-result previews, coordinator-aware finalization messaging, and frozen-state messaging. The Dosen dashboard shows bounded grading progress for its newest assigned classes.

The shared ADMIN/AKADEMIK class page renders the same grading data in **Pengawasan Penilaian** mode without ordinary create/edit/score/finalize controls. After finalization it exposes only the existing reason-required administrative correction action. These responsibility changes require no database schema or migration: `kelas_dosen`, `komponen_nilai`, `nilai_mahasiswa`, and `hasil_studi` remain unchanged.

Verification:

```sh
bun test
bun run check
bun run build
RUN_GRADING_DB_TESTS=1 bun --env-file=packages/db/.env test packages/db/src/grading-schema.integration.test.ts
RUN_GRADING_APP_DB_TESTS=1 bun --env-file=packages/db/.env test apps/api/src/modules/nilai/nilai.integration.test.ts
RUN_GRADING_E2E=1 bun --env-file=packages/db/.env test apps/web/src/lib/server/grading-flow.test.ts
git diff --check
```

## KHS, IPS, and IPK

Academic results use the read-only `hasil-studi` Route → Service → Repository → Drizzle module. No KHS, IPS, IPK, total-credit, or weighted-point snapshot is stored. `hasil_studi` is the authoritative finalized course-attempt history; current grading component configuration, preview calculations, current grade mapping, and later KRS state are never used to reinterpret it.

Authenticated MAHASISWA endpoints are scoped from the session-linked student profile and accept no student id:

- `GET /mahasiswa/me/hasil-studi` lists semesters containing finalized results and a concise cumulative summary.
- `GET /mahasiswa/me/khs/:semesterId` returns one semester's finalized course attempts and IPS summary.
- `GET /mahasiswa/me/ipk` returns the cumulative result.

ADMIN and AKADEMIK use the same service calculations through:

- `GET /mahasiswa/:id/hasil-studi`
- `GET /mahasiswa/:id/khs/:semesterId`
- `GET /mahasiswa/:id/ipk`

DOSEN receives no general KHS or cumulative IPK access. A student cannot supply or alter a student id on self-service routes. Every service read verifies the current database account remains active with the same authorized role.

KHS joins each finalized `hasil_studi` to its `kelas_kuliah`, `semester`, and immutable-in-use `mata_kuliah` identity/SKS. Only semesters with at least one finalized result appear in the semester list. An effective approved KRS course without a result is reported only through `unfinishedCourseCount` and makes that semester summary `provisional`; it is excluded from both the KHS course rows and calculation. A cancelled-before-finalization enrollment likewise contributes nothing. A finalized result remains after KRS reopen/cancellation, including after the enrollment is no longer effective.

IPS for one semester is:

```text
SUM(mata_kuliah.sks × hasil_studi.nilai_indeks)
------------------------------------------------
             SUM(mata_kuliah.sks)
```

IPK uses the same formula over all of the student's finalized results across semesters. A finalized zero index is a real awarded result: its weighted contribution is zero and its SKS remains in the denominator. No result means unfinished, not failure. The stored `hasil_studi.nilai_indeks` is used directly; neither the stored letter nor numeric score is mapped again.

Calculations in `academic-result.ts` parse PostgreSQL numeric strings into integer hundredths and accumulate `SKS × index` with `BigInt`. The API returns exact weighted grade-point totals with two decimals. Only the final IPS/IPK quotient is rounded for display to two decimals, deterministically using round-half-up. An empty finalized result set returns `0.00` weighted points, zero SKS, and a null IPS/IPK instead of inventing a zero academic index. Frontend pages render these backend values and do not recalculate them.

The current development inclusion behavior counts every finalized course attempt, including the same mata kuliah repeated in different semesters. Responses expose `COUNT_ALL_FINALIZED_ATTEMPTS` and whether repeated courses are present; the UI states this limitation. This is a simple interim inclusion model, not an institutional replacement/exclusion rule. Best/latest-attempt replacement, retained-credit rules, transfer credit, equivalency, result annulment, graduation rules, and official transcript/KHS issuance remain future academic-policy extensions.

Students use `/mahasiswa/khs`. ADMIN/AKADEMIK open the shared results component from a student's row at `/akademik/mahasiswa/:id/hasil-studi`. Both views provide a finalized-result semester selector, course code/name/class/SKS, stored numeric/letter/index values, semester SKS and weighted points, IPS, cumulative SKS and weighted points, and IPK. IPS is labeled as semester performance and IPK as cumulative performance.

Verification:

```sh
bun test
bun run check
bun run build
RUN_ACADEMIC_RESULTS_DB_TESTS=1 bun --env-file=packages/db/.env test apps/api/src/modules/hasil-studi/hasil-studi.integration.test.ts
git diff --check
```

## Pertemuan Kuliah and Absensi Mahasiswa database extension

The database package implements the documented `pertemuan` and `absensi` tables and their Drizzle relations. Migration `0001_hard_weapon_omega.sql` adds only these tables, their restrictive foreign keys, unique constraints, row-local CHECK constraints, and documented indexes. Attendance status has no database default: rows are created lazily, and a missing row is not ALPHA.

Run the schema contract and opt-in local PostgreSQL integration tests from the repository root:

```sh
bun test packages/db/src/schema.test.ts
RUN_ATTENDANCE_DB_TESTS=1 bun --env-file=packages/db/.env test packages/db/src/attendance-schema.integration.test.ts
bun run check
```

The PostgreSQL test requires the migrated local `kampusia` database. It validates both tables, foreign keys and actor references, then proves that duplicate meeting numbers, duplicate student attendance, missing/invalid explicit statuses, invalid row-local values, and invalid references are rejected. All test fixtures roll back.

The schema extension deliberately leaves semester-range validation, effective-enrollment checks, authorization, lifecycle transitions, complete-roster finalization, correction policy, and concurrency locking to the application layer described below. It does not add attendance fan-out or automatic ALPHA behavior.

## Pertemuan Kuliah and Absensi Mahasiswa application module

The application layer implements Pertemuan and Absensi through the existing Route → Service → Repository → Drizzle structure. It does not change the database schema, migrations, or development seed.

Authorization is deliberately split by responsibility:

- ADMIN/AKADEMIK use `POST /kelas-kuliah/:id/pertemuan`, `PATCH /pertemuan/:id`, and `POST /pertemuan/:id/cancel` to create, edit/correct, and cancel meeting metadata. ADMIN has the same administrative capability as AKADEMIK.
- Creating a TERJADWAL meeting is the “open meeting” action. No separate draft/open column or migration is needed.
- ADMIN/AKADEMIK and an assigned DOSEN use `GET /kelas-kuliah/:id/pertemuan` and `GET /pertemuan/:id` within their allowed class scope.
- An assigned DOSEN uses `POST /pertemuan/:id/complete` as the attendance-centric “Selesaikan Absensi” action; ADMIN/AKADEMIK retain oversight access to the same completion transition.
- `GET /pertemuan/:id/absensi` for the effective roster and retained historical rows.
- `PUT /pertemuan/:id/absensi/:mahasiswaId` for initial/incremental entry and `PATCH` on the same path for an in-place correction.

DOSEN class discovery is scoped through `GET /dosen/me/kelas-kuliah` and its `/:id` detail. The repository derives this list from `kelas_dosen`; changing a path ID never grants access to an unassigned class. ADMIN and AKADEMIK continue from the existing class detail. The web pages are `/dosen/kelas-kuliah`, the role-specific class details and attendance pages, and `/akademik/pertemuan/:id`.

MAHASISWA use only `GET /mahasiswa/me/absensi` and `/mahasiswa/absensi`. The profile is derived from the authenticated account; there is no student ID parameter and no attendance mutation in the student UI.

The effective roster is derived only from an AKTIF `krs_detail` whose parent KRS is DISETUJUI. DRAFT, DIAJUKAN, DITOLAK, and DIBATALKAN plans do not appear. Rows are lazy: the roster returns `BELUM_DICATAT` with a null attendance value when no row exists, never inferred ALPHA. Finalization locks related KRS rows, then the class, meeting, and attendance rows in the documented order. It rejects incomplete coverage with the missing count and changes the meeting to SELESAI only in the same successful SERIALIZABLE transaction. An empty effective roster is valid.

TERJADWAL meetings accept incremental attendance from an assigned DOSEN or ADMIN/AKADEMIK. DIBATALKAN meetings accept none. Existing rows are corrected in place, preserving `created_at` and `dicatat_oleh` while updating `updated_at` and `diubah_oleh`. Once attendance is completed, the DOSEN workspace is read-only; completed corrections require ADMIN/AKADEMIK and an explicit note. ADMIN/AKADEMIK can also make an explicit, justified late insertion for a currently effective student; DOSEN cannot. Existing attendance remains visible as historical data after KRS reopen/cancellation or other prospective enrollment changes. No revision log or roster snapshot is created.

Verification:

```sh
bun test
bun --filter api check
bun --filter @kampusia/db check
bun --bun --cwd apps/web run check
bun --filter api build
bun --bun --cwd apps/web run build
RUN_ATTENDANCE_APP_DB_TESTS=1 bun --env-file=packages/db/.env test apps/api/src/modules/pertemuan/pertemuan.integration.test.ts
```

The isolated tests cover ADMIN/AKADEMIK meeting ownership, rejected DOSEN metadata mutations, assigned/unassigned DOSEN scope, meeting lifecycle, date/number validation, all four explicit attendance statuses, lazy missing rows, completed-attendance read-only behavior, administrative correction actor metadata, retained history, completion coverage, cancellation safeguards, CSRF, and student scoping. The opt-in PostgreSQL test additionally proves DRAFT/DIAJUKAN exclusion, atomic failed completion, successful finalization, KRS reopen retention, and in-place correction against real constraints.
