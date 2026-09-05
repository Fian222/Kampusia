# AGENTS.md

## Project Overview

This repository contains a mini Campus Information System built as a monorepo.

Primary stack:

* Runtime: Bun
* Language: TypeScript
* Frontend: SvelteKit
* Backend: ElysiaJS
* API Client: Eden Treaty
* ORM: Drizzle ORM
* Database: PostgreSQL
* Styling: Tailwind CSS
* Package management: Bun Workspaces

The application should remain modular, type-safe, maintainable, and easy to extend.

---

## Repository Structure

```text
campus-system/
├── apps/
│   ├── web/
│   │   └── SvelteKit frontend
│   │
│   └── api/
│       └── ElysiaJS backend
│
├── packages/
│   └── db/
│       ├── schema/
│       ├── migrations/
│       └── database utilities
│
├── package.json
├── bun.lock
└── AGENTS.md
```

Preferred backend structure:

```text
apps/api/src/
├── modules/
│   ├── auth/
│   ├── mahasiswa/
│   ├── dosen/
│   ├── fakultas/
│   ├── program-studi/
│   ├── mata-kuliah/
│   ├── kurikulum/
│   ├── semester/
│   ├── kelas/
│   ├── krs/
│   ├── jadwal/
│   ├── absensi/
│   └── nilai/
│
├── middleware/
├── plugins/
├── utils/
└── index.ts
```

Preferred frontend structure:

```text
apps/web/src/
├── lib/
│   ├── api/
│   ├── components/
│   ├── stores/
│   ├── types/
│   └── utils/
│
└── routes/
    ├── login/
    ├── admin/
    ├── mahasiswa/
    └── dosen/
```

---

# General Rules

## 1. Use TypeScript

Use TypeScript for all application code.

Avoid:

```ts
const data: any = ...
```

Prefer proper inferred or explicit types.

Use `unknown` when a value is genuinely unknown and narrow it before use.

Do not duplicate types that can be inferred from Elysia, Eden, Drizzle, or database schemas.

---

## 2. Prefer Type Safety

The project should maintain type safety across:

```text
PostgreSQL
    ↓
Drizzle
    ↓
Elysia
    ↓
Eden Treaty
    ↓
SvelteKit
```

Prefer inferred types whenever practical.

Frontend API calls should use Eden Treaty instead of manually duplicating API response interfaces.

Avoid manual `fetch()` calls when an existing Eden client can be used.

---

# Backend Rules

## ElysiaJS

Backend endpoints belong in:

```text
apps/api/src/modules/
```

Organize functionality by domain rather than technical layer.

Preferred:

```text
modules/
└── mahasiswa/
    ├── mahasiswa.model.ts
    ├── mahasiswa.service.ts
    ├── mahasiswa.repository.ts
    └── mahasiswa.route.ts
```

Do not create oversized route files containing database queries, validation, and business logic all together.

Keep responsibilities separated:

```text
Route
↓
Service
↓
Repository
↓
Database
```

### Route

Responsible for:

* HTTP endpoint
* input validation
* authentication / authorization
* calling service
* response status

### Service

Responsible for:

* business logic
* transaction orchestration
* domain validation

### Repository

Responsible for:

* Drizzle queries
* database persistence
* database lookup

Do not place business rules inside repository functions.

---

## API Naming

Use REST-style naming.

Prefer:

```text
GET    /mahasiswa
GET    /mahasiswa/:id
POST   /mahasiswa
PATCH  /mahasiswa/:id
DELETE /mahasiswa/:id
```

For nested domain actions:

```text
GET /kelas/:id/mahasiswa
GET /kelas/:id/jadwal
GET /kelas/:id/nilai
GET /mahasiswa/:id/krs
GET /mahasiswa/:id/khs
```

Avoid endpoint names such as:

```text
/getMahasiswa
/createMahasiswa
/updateMahasiswa
```

---

## Response Format

Use predictable API responses.

Successful response example:

```json
{
  "success": true,
  "data": {}
}
```

List response:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

Error example:

```json
{
  "success": false,
  "message": "Mahasiswa tidak ditemukan"
}
```

Do not expose raw database errors to clients.

---

# Database Rules

## PostgreSQL + Drizzle

Database schemas belong in:

```text
packages/db/schema/
```

Split schemas by logical domain.

Example:

```text
schema/
├── users.ts
├── akademik.ts
├── mahasiswa.ts
├── dosen.ts
├── kelas.ts
├── krs.ts
└── nilai.ts
```

Avoid putting every table into one large schema file.

---

## Naming Convention

Use PostgreSQL `snake_case`.

Example:

```text
program_studi
mata_kuliah
kelas_kuliah
krs_detail
komponen_nilai
nilai_mahasiswa
```

Columns:

```text
program_studi_id
mata_kuliah_id
created_at
updated_at
```

TypeScript properties may use camelCase if mapped through Drizzle.

---

## Primary Keys

Prefer UUID for application entities unless there is a good reason to use sequential IDs.

Example:

```ts
id: uuid('id').defaultRandom().primaryKey()
```

Do not use business identifiers such as NIM or NIDN as primary keys.

Instead:

```text
id  → primary key
nim → unique business identifier
```

Example:

```text
id  = UUID
nim = 2026010001
```

---

## Foreign Keys

Use explicit foreign keys.

Example:

```text
mahasiswa.program_studi_id
             ↓
program_studi.id
```

Add indexes to foreign-key columns that are frequently used for joins or filtering.

---

## Unique Constraints

Use database constraints for data integrity.

Examples:

```text
mahasiswa.nim UNIQUE
dosen.nidn UNIQUE
mata_kuliah.kode UNIQUE
semester.kode UNIQUE
```

Composite constraints should be used where required.

Example:

A student must not enroll into the same class twice:

```text
UNIQUE(krs_id, kelas_kuliah_id)
```

---

# Academic Domain Rules

## Mahasiswa

Students belong to a study program.

Main relationship:

```text
fakultas
   ↓
program_studi
   ↓
mahasiswa
```

Do not duplicate faculty information inside `mahasiswa`.

---

## Dosen

A lecturer may have a homebase study program.

Do not assume one lecturer can teach only one class or one study program.

Class lecturer assignments should use:

```text
kelas_dosen
```

rather than putting only:

```text
kelas_kuliah.dosen_id
```

This allows one class to have multiple lecturers.

---

## Kurikulum

Do not permanently attach a recommended semester directly to `mata_kuliah`.

Use:

```text
kurikulum
      ↓
kurikulum_matkul
      ↓
mata_kuliah
```

This allows curriculum changes without duplicating course records.

---

## Semester

Classes must belong to a specific academic semester.

Example:

```text
20261 = Ganjil 2026/2027
20262 = Genap 2026/2027
```

Do not infer active semester based only on current date.

The active semester should be explicitly configured.

---

## Kelas Kuliah

`kelas_kuliah` represents a course offering in a specific semester.

Example:

```text
Mata Kuliah: Basis Data
Semester: 20261
Kelas: A
```

Students do not enroll directly into `mata_kuliah`.

Students enroll into `kelas_kuliah`.

---

## KRS

Preferred structure:

```text
mahasiswa
    ↓
krs
    ↓
krs_detail
    ↓
kelas_kuliah
```

`krs` represents a student's study plan for one semester.

`krs_detail` represents individual classes selected in that study plan.

---

## Student Count Per Class

The number of students in a class should be calculated from active KRS detail records.

Conceptually:

```sql
COUNT(krs_detail)
GROUP BY kelas_kuliah
```

Do not store `jumlah_mahasiswa` permanently in `kelas_kuliah` unless there is a demonstrated performance requirement.

Calculated values should remain derived whenever practical.

---

## Jadwal

A schedule belongs to a class.

```text
kelas_kuliah
     ↓
jadwal_kuliah
     ↓
ruangan
```

Before inserting or updating a schedule, check for conflicts such as:

* same room at overlapping time
* same lecturer at overlapping time
* same class at overlapping time

---

## Pertemuan and Absensi

Attendance belongs to a class meeting.

Structure:

```text
kelas_kuliah
      ↓
pertemuan
      ↓
absensi
      ↓
mahasiswa
```

Do not store attendance directly against `kelas_kuliah` without a meeting reference.

Typical attendance statuses:

```text
HADIR
IZIN
SAKIT
ALPHA
```

Prefer enums or constrained values.

---

## Nilai

Do not hardcode columns like:

```text
nilai_tugas
nilai_uts
nilai_uas
```

Prefer dynamic assessment components:

```text
kelas_kuliah
      ↓
komponen_nilai
      ↓
nilai_mahasiswa
```

Example components:

```text
Tugas       20%
Quiz        10%
UTS         30%
UAS         40%
```

The total component weight for one class should normally equal:

```text
100%
```

Validate this rule at the application/service layer.

---

# Transactions

Use database transactions whenever multiple writes form one logical operation.

Examples:

* creating KRS and KRS details
* deleting KRS with related details
* submitting multiple grades
* finalizing semester grades
* creating class and lecturer assignments

Example conceptual flow:

```text
BEGIN

create KRS
create KRS details
validate SKS
validate duplicate classes

COMMIT
```

If any operation fails:

```text
ROLLBACK
```

---

# Authentication and Authorization

Keep authentication and domain data separate.

Use:

```text
users
```

for login credentials.

Then associate users with:

```text
mahasiswa
dosen
```

Typical roles:

```text
ADMIN
AKADEMIK
DOSEN
MAHASISWA
```

Never rely only on frontend authorization.

Every protected backend endpoint must verify permission.

Example:

A mahasiswa must not be able to update another student's KRS by changing an ID in the request.

Authorization must be enforced server-side.

---

# Frontend Rules

## SvelteKit

Use SvelteKit rather than plain Svelte.

Prefer route groups/layouts for role-based dashboards.

Example:

```text
routes/
├── (auth)/
│   └── login/
│
├── (admin)/
│   └── admin/
│
├── (mahasiswa)/
│   └── mahasiswa/
│
└── (dosen)/
    └── dosen/
```

Use reusable components for common UI.

Examples:

```text
DataTable
Pagination
SearchInput
Modal
ConfirmDialog
FormField
StatusBadge
```

Avoid duplicating table and form implementations across pages.

---

# UI and UX

The application is an academic administration system.

Prioritize:

* clarity
* consistency
* fast data entry
* readable tables
* useful validation messages
* responsive layout

Avoid unnecessary animations or visual complexity.

Desktop usage is important because administrative users frequently work with large tables.

Pages should still remain usable on mobile devices.

---

# Forms

Use clear validation feedback.

Do not silently ignore invalid input.

Example:

Instead of:

```text
Error
```

Prefer:

```text
NIM sudah digunakan oleh mahasiswa lain.
```

or:

```text
Total bobot komponen nilai harus 100%.
```

Keep frontend and backend validation consistent.

Backend validation remains authoritative.

---

# Pagination

Large datasets must use pagination.

Do not retrieve thousands of student records at once.

Example API:

```text
GET /mahasiswa?page=1&limit=20
```

Support filtering where useful:

```text
GET /mahasiswa?search=ahmad
GET /mahasiswa?programStudiId=...
GET /mahasiswa?angkatan=2026
```

---

# Search

Search endpoints should avoid inefficient wildcard scans when datasets become large.

Common searchable fields:

```text
mahasiswa:
- nim
- nama

dosen:
- nidn
- nama

mata_kuliah:
- kode
- nama
```

Add appropriate database indexes when query patterns justify them.

---

# Error Handling

Use consistent error handling.

Expected domain errors include:

* resource not found
* duplicate data
* invalid KRS
* schedule conflict
* class capacity exceeded
* invalid grade component weight
* unauthorized action

Do not return stack traces in production responses.

Log unexpected server errors.

---

# Performance

Avoid premature optimization.

Prefer:

1. correct schema
2. correct indexes
3. efficient queries
4. pagination
5. profiling
6. optimization

Avoid N+1 queries.

Prefer joins or batched queries where appropriate.

Do not denormalize database tables without a clear reason.

---

# Security

Never commit:

```text
.env
database credentials
JWT secrets
API keys
private keys
```

Use environment variables.

Validate all external input.

Use parameterized queries through Drizzle.

Never construct raw SQL using untrusted string concatenation.

Passwords must be hashed using a secure password hashing algorithm.

Never store plaintext passwords.

---

# Code Style

Prefer simple, readable code.

Avoid unnecessary abstractions.

Functions should have clear responsibilities.

Prefer:

```ts
getMahasiswaById()
createKrs()
getMahasiswaByKelas()
calculateIps()
```

over vague names such as:

```ts
processData()
handleSomething()
doTask()
```

Use Indonesian domain terminology where it matches the business concept:

```text
mahasiswa
dosen
mataKuliah
kelasKuliah
semester
krs
nilai
```

Use English for generic technical terminology where appropriate:

```text
service
repository
middleware
handler
config
```

Do not mix naming inconsistently.

---

# Import Rules

Prefer project aliases instead of deeply nested relative imports.

Avoid:

```ts
import { db } from '../../../../../../db';
```

Prefer:

```ts
import { db } from '@campus/db';
```

when workspace aliases are available.

---

# Environment Configuration

Expected environments:

```text
development
test
production
```

Typical environment variables:

```env
DATABASE_URL=
JWT_SECRET=
API_PORT=
WEB_URL=
```

Never hardcode production URLs in source files.

---

# Testing

Important business logic should have automated tests.

Prioritize tests for:

* authentication
* authorization
* KRS submission
* duplicate KRS prevention
* maximum SKS validation
* schedule conflicts
* class capacity
* grade calculation
* IPS calculation
* IPK calculation

Do not focus only on trivial CRUD tests.

Business rules are more important.

---

# Commands

Use Bun commands.

Install dependencies:

```bash
bun install
```

Run development environment:

```bash
bun dev
```

Run backend:

```bash
bun --filter api dev
```

Run frontend:

```bash
bun --filter web dev
```

Run tests:

```bash
bun test
```

When package scripts differ, inspect the repository's `package.json` before assuming a command exists.

---

# Migration Rules

Database schema changes must use Drizzle migrations.

Do not manually modify production database structures without a migration.

Typical workflow:

```text
change Drizzle schema
        ↓
generate migration
        ↓
inspect migration
        ↓
apply migration
```

Never delete existing data or tables casually.

For destructive schema changes, explain the impact before applying them.

---

# Agent Working Rules

Before modifying code:

1. Inspect the existing project structure.
2. Read relevant files.
3. Understand existing conventions.
4. Reuse existing utilities and components.
5. Avoid introducing duplicate implementations.

Do not rewrite large parts of the project when a small targeted change is sufficient.

Do not change unrelated files.

Do not rename public APIs, database columns, or routes unless necessary.

When modifying database structures, inspect:

* schema
* migrations
* queries
* API
* frontend usage

before making the change.

---

# Agent Verification

After implementing a change, verify relevant checks where available:

```text
TypeScript type checking
lint
tests
build
database schema consistency
```

Fix errors caused by the change.

Do not hide errors by:

* disabling TypeScript checks
* using excessive `any`
* suppressing lint rules globally
* removing tests
* weakening validation

---

# Feature Development Order

When implementing new features, prefer this order:

```text
1. Understand business rule
2. Design database relationship
3. Update Drizzle schema
4. Create migration
5. Implement repository
6. Implement service
7. Implement Elysia endpoint
8. Expose type-safe API through Eden
9. Build SvelteKit UI
10. Add validation
11. Test business rules
```

---

# Initial Project Scope

The first version of the project should focus on:

### Admin / Akademik

* authentication
* dashboard
* fakultas
* program studi
* mahasiswa
* dosen
* mata kuliah
* kurikulum
* semester
* kelas kuliah
* dosen pengajar
* jadwal kuliah
* ruangan

### Mahasiswa

* dashboard
* profile
* KRS
* jadwal kuliah
* attendance history
* KHS
* IPS
* IPK

### Dosen

* dashboard
* kelas yang diajar
* daftar mahasiswa per kelas
* pertemuan
* absensi
* komponen nilai
* input nilai

Do not expand the initial scope into unrelated campus modules such as:

* finance
* payroll
* library
* admissions
* HR
* asset management

unless explicitly requested.

---

# Architecture Principle

Always prefer:

```text
simple
correct
type-safe
maintainable
```

over:

```text
clever
over-engineered
prematurely optimized
```

This project is intended to demonstrate good application architecture and realistic academic-system business logic, not unnecessary enterprise complexity.

## Database Documentation

Before making any database-related changes, including schemas, migrations,
relationships, queries, academic domain models, or API/frontend code that
depends on database structure or rules, read [docs/DATABASE.md](docs/DATABASE.md).

`docs/DATABASE.md` is the source of truth for the database design.
Do not introduce new tables, columns, or relationships that conflict with
it without updating the documentation first.
