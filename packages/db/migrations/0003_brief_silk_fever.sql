ALTER TABLE "krs" DROP CONSTRAINT "krs_status_timestamps_check";--> statement-breakpoint
ALTER TABLE "krs" ADD COLUMN "ditolak_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "krs" ADD COLUMN "ditolak_oleh" uuid;--> statement-breakpoint
ALTER TABLE "krs" ADD COLUMN "alasan_penolakan" text;--> statement-breakpoint
ALTER TABLE "krs" ADD COLUMN "dibuka_kembali_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "krs" ADD COLUMN "dibuka_kembali_oleh" uuid;--> statement-breakpoint
ALTER TABLE "krs" ADD COLUMN "dibatalkan_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "krs" ADD COLUMN "dibatalkan_oleh" uuid;--> statement-breakpoint
ALTER TABLE "krs" ADD COLUMN "alasan_pembatalan" text;--> statement-breakpoint
ALTER TABLE "mahasiswa" ADD COLUMN "dosen_pa_id" uuid;--> statement-breakpoint
ALTER TABLE "semester" ADD COLUMN "krs_mulai_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "semester" ADD COLUMN "krs_selesai_at" timestamp with time zone;--> statement-breakpoint
-- Preserve retained workflow timestamps while correcting legacy development rows whose
-- generic creation timestamp was written after their known submission/approval events.
UPDATE "krs"
SET "created_at" = LEAST(
	"created_at",
	COALESCE("diajukan_at", "created_at"),
	COALESCE("disetujui_at", "created_at")
)
WHERE ("diajukan_at" IS NOT NULL AND "diajukan_at" < "created_at")
	OR ("disetujui_at" IS NOT NULL AND "disetujui_at" < "created_at");--> statement-breakpoint
ALTER TABLE "krs" ADD CONSTRAINT "krs_ditolak_oleh_users_id_fk" FOREIGN KEY ("ditolak_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "krs" ADD CONSTRAINT "krs_dibuka_kembali_oleh_users_id_fk" FOREIGN KEY ("dibuka_kembali_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "krs" ADD CONSTRAINT "krs_dibatalkan_oleh_users_id_fk" FOREIGN KEY ("dibatalkan_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "mahasiswa" ADD CONSTRAINT "mahasiswa_dosen_pa_id_dosen_id_fk" FOREIGN KEY ("dosen_pa_id") REFERENCES "public"."dosen"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "mahasiswa_dosen_pa_id_idx" ON "mahasiswa" USING btree ("dosen_pa_id");--> statement-breakpoint
ALTER TABLE "krs" ADD CONSTRAINT "krs_rejection_fields_check" CHECK ((
      ("krs"."ditolak_at" IS NULL AND "krs"."ditolak_oleh" IS NULL AND "krs"."alasan_penolakan" IS NULL)
      OR ("krs"."ditolak_at" IS NOT NULL AND "krs"."ditolak_oleh" IS NOT NULL AND "krs"."alasan_penolakan" IS NOT NULL AND btrim("krs"."alasan_penolakan") <> '')
    ));--> statement-breakpoint
ALTER TABLE "krs" ADD CONSTRAINT "krs_reopening_pair_check" CHECK (("krs"."dibuka_kembali_at" IS NULL) = ("krs"."dibuka_kembali_oleh" IS NULL));--> statement-breakpoint
ALTER TABLE "krs" ADD CONSTRAINT "krs_cancellation_fields_check" CHECK ((
      ("krs"."dibatalkan_at" IS NULL AND "krs"."dibatalkan_oleh" IS NULL AND "krs"."alasan_pembatalan" IS NULL)
      OR ("krs"."dibatalkan_at" IS NOT NULL AND "krs"."dibatalkan_oleh" IS NOT NULL AND "krs"."alasan_pembatalan" IS NOT NULL AND btrim("krs"."alasan_pembatalan") <> '')
    ));--> statement-breakpoint
ALTER TABLE "krs" ADD CONSTRAINT "krs_event_timestamps_check" CHECK (
      ("krs"."diajukan_at" IS NULL OR "krs"."diajukan_at" >= "krs"."created_at")
      AND ("krs"."disetujui_at" IS NULL OR "krs"."disetujui_at" >= "krs"."created_at")
      AND ("krs"."ditolak_at" IS NULL OR "krs"."ditolak_at" >= "krs"."created_at")
      AND ("krs"."dibuka_kembali_at" IS NULL OR "krs"."dibuka_kembali_at" >= "krs"."created_at")
      AND ("krs"."dibatalkan_at" IS NULL OR "krs"."dibatalkan_at" >= "krs"."created_at")
    );--> statement-breakpoint
ALTER TABLE "krs" ADD CONSTRAINT "krs_status_timestamps_check" CHECK ((
      ("krs"."status" = 'DRAFT' AND "krs"."diajukan_at" IS NULL)
      OR ("krs"."status" = 'DIAJUKAN' AND "krs"."diajukan_at" IS NOT NULL)
      OR ("krs"."status" = 'DISETUJUI' AND "krs"."diajukan_at" IS NOT NULL AND "krs"."disetujui_at" IS NOT NULL AND "krs"."disetujui_oleh" IS NOT NULL AND "krs"."disetujui_at" >= "krs"."diajukan_at")
      OR ("krs"."status" = 'DITOLAK' AND "krs"."diajukan_at" IS NOT NULL AND "krs"."ditolak_at" IS NOT NULL AND "krs"."ditolak_oleh" IS NOT NULL AND "krs"."alasan_penolakan" IS NOT NULL AND "krs"."ditolak_at" >= "krs"."diajukan_at")
      OR ("krs"."status" = 'DIBATALKAN' AND "krs"."dibatalkan_at" IS NOT NULL AND "krs"."dibatalkan_oleh" IS NOT NULL AND "krs"."alasan_pembatalan" IS NOT NULL)
    ));--> statement-breakpoint
ALTER TABLE "semester" ADD CONSTRAINT "semester_krs_window_check" CHECK ((
      ("semester"."krs_mulai_at" IS NULL AND "semester"."krs_selesai_at" IS NULL)
      OR ("semester"."krs_mulai_at" IS NOT NULL AND "semester"."krs_selesai_at" IS NOT NULL AND "semester"."krs_mulai_at" < "semester"."krs_selesai_at")
    ));
