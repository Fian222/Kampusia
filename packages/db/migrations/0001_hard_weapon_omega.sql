CREATE TABLE "absensi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pertemuan_id" uuid NOT NULL,
	"mahasiswa_id" uuid NOT NULL,
	"status" varchar(8) NOT NULL,
	"keterangan" text,
	"dicatat_oleh" uuid NOT NULL,
	"diubah_oleh" uuid NOT NULL,
	CONSTRAINT "absensi_pertemuan_id_mahasiswa_id_unique" UNIQUE("pertemuan_id","mahasiswa_id"),
	CONSTRAINT "absensi_status_check" CHECK ("absensi"."status" IN ('HADIR', 'IZIN', 'SAKIT', 'ALPHA')),
	CONSTRAINT "absensi_keterangan_nonblank_check" CHECK ("absensi"."keterangan" ~ '[^[:space:]]')
);
--> statement-breakpoint
CREATE TABLE "pertemuan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kelas_kuliah_id" uuid NOT NULL,
	"nomor_pertemuan" smallint NOT NULL,
	"tanggal" date NOT NULL,
	"jam_mulai" time NOT NULL,
	"jam_selesai" time NOT NULL,
	"materi" text,
	"status" varchar(16) DEFAULT 'TERJADWAL' NOT NULL,
	CONSTRAINT "pertemuan_kelas_kuliah_id_nomor_pertemuan_unique" UNIQUE("kelas_kuliah_id","nomor_pertemuan"),
	CONSTRAINT "pertemuan_nomor_pertemuan_positive_check" CHECK ("pertemuan"."nomor_pertemuan" > 0),
	CONSTRAINT "pertemuan_jam_range_check" CHECK ("pertemuan"."jam_mulai" < "pertemuan"."jam_selesai"),
	CONSTRAINT "pertemuan_status_check" CHECK ("pertemuan"."status" IN ('TERJADWAL', 'SELESAI', 'DIBATALKAN')),
	CONSTRAINT "pertemuan_materi_nonblank_check" CHECK ("pertemuan"."materi" ~ '[^[:space:]]')
);
--> statement-breakpoint
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_pertemuan_id_pertemuan_id_fk" FOREIGN KEY ("pertemuan_id") REFERENCES "public"."pertemuan"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_mahasiswa_id_mahasiswa_id_fk" FOREIGN KEY ("mahasiswa_id") REFERENCES "public"."mahasiswa"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_dicatat_oleh_users_id_fk" FOREIGN KEY ("dicatat_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_diubah_oleh_users_id_fk" FOREIGN KEY ("diubah_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "pertemuan" ADD CONSTRAINT "pertemuan_kelas_kuliah_id_kelas_kuliah_id_fk" FOREIGN KEY ("kelas_kuliah_id") REFERENCES "public"."kelas_kuliah"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "absensi_mahasiswa_id_pertemuan_id_idx" ON "absensi" USING btree ("mahasiswa_id","pertemuan_id");--> statement-breakpoint
CREATE INDEX "pertemuan_tanggal_status_idx" ON "pertemuan" USING btree ("tanggal","status");