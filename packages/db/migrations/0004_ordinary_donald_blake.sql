ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dosen" ADD COLUMN "nik" varchar(30);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "login_id" varchar(30);--> statement-breakpoint
ALTER TABLE "dosen" ADD CONSTRAINT "dosen_nik_unique" UNIQUE("nik");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_login_id_unique" UNIQUE("login_id");--> statement-breakpoint
ALTER TABLE "dosen" ADD CONSTRAINT "dosen_nik_digits_check" CHECK ("dosen"."nik" IS NULL OR "dosen"."nik" ~ '^[0-9]+$');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_login_id_digits_check" CHECK ("users"."login_id" IS NULL OR "users"."login_id" ~ '^[0-9]+$');--> statement-breakpoint
-- Only the fixed development fixture UUIDs receive deterministic replacement NIMs.
-- A non-fixture alphanumeric NIM is never guessed or rewritten by this migration.
UPDATE "mahasiswa" AS "m"
SET "nim" = "mapping"."nim"
FROM (VALUES
	('20260000-0000-4000-8000-000900000001'::uuid, 'DEV20260001', '99202601'),
	('20260000-0000-4000-8000-000900000002'::uuid, 'DEV20260002', '99202602'),
	('20260000-0000-4000-8000-000900000003'::uuid, 'DEV20260003', '99202603'),
	('20260000-0000-4000-8000-000900000004'::uuid, 'DEV20260004', '99202604'),
	('20260000-0000-4000-8000-000900000005'::uuid, 'DEV20260005', '99202605')
) AS "mapping"("id", "legacy_nim", "nim")
WHERE "m"."id" = "mapping"."id"
	AND "m"."nim" = "mapping"."legacy_nim";--> statement-breakpoint
-- ADMIN, AKADEMIK, and the linked DOSEN fixture use only the documented
-- development identifiers. Role guards prevent taking over a modified account.
UPDATE "users" AS "u"
SET "login_id" = "mapping"."login_id"
FROM (VALUES
	('20260000-0000-4000-8000-000100000002'::uuid, 'ADMIN', '99000001'),
	('20260000-0000-4000-8000-000100000001'::uuid, 'AKADEMIK', '99000002'),
	('20260000-0000-4000-8000-000100000003'::uuid, 'DOSEN', '99000003')
) AS "mapping"("id", "role", "login_id")
WHERE "u"."id" = "mapping"."id"
	AND "u"."role" = "mapping"."role"
	AND "u"."login_id" IS NULL;--> statement-breakpoint
UPDATE "dosen"
SET "nik" = '99000003'
WHERE "id" = '20260000-0000-4000-8000-000800000001'::uuid
	AND "user_id" = '20260000-0000-4000-8000-000100000003'::uuid
	AND "nik" IS NULL;--> statement-breakpoint
-- A linked MAHASISWA account can be mapped without invention only when its
-- source NIM already satisfies the new identifier format and has no collision.
UPDATE "users" AS "u"
SET "login_id" = "m"."nim"
FROM "mahasiswa" AS "m"
WHERE "m"."user_id" = "u"."id"
	AND "u"."role" = 'MAHASISWA'
	AND "u"."login_id" IS NULL
	AND "m"."nim" ~ '^[0-9]+$'
	AND NOT EXISTS (
		SELECT 1
		FROM "users" AS "owner"
		WHERE "owner"."login_id" = "m"."nim"
			AND "owner"."id" <> "u"."id"
	);
