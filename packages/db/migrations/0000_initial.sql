CREATE TABLE "dosen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"program_studi_id" uuid,
	"kode_dosen" varchar(30) NOT NULL,
	"nidn" varchar(30),
	"nama" varchar(150) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "dosen_kode_dosen_unique" UNIQUE("kode_dosen"),
	CONSTRAINT "dosen_nidn_unique" UNIQUE("nidn"),
	CONSTRAINT "dosen_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "dosen_kode_dosen_nonblank_check" CHECK ("dosen"."kode_dosen" ~ '[^[:space:]]'),
	CONSTRAINT "dosen_kode_dosen_canonical_check" CHECK ("dosen"."kode_dosen" = upper("dosen"."kode_dosen") AND "dosen"."kode_dosen" !~ '^[[:space:]]|[[:space:]]$'),
	CONSTRAINT "dosen_nidn_nonblank_check" CHECK ("dosen"."nidn" ~ '[^[:space:]]'),
	CONSTRAINT "dosen_nidn_canonical_check" CHECK ("dosen"."nidn" = upper("dosen"."nidn") AND "dosen"."nidn" !~ '^[[:space:]]|[[:space:]]$'),
	CONSTRAINT "dosen_nama_nonblank_check" CHECK ("dosen"."nama" ~ '[^[:space:]]')
);
--> statement-breakpoint
CREATE TABLE "fakultas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kode" varchar(20) NOT NULL,
	"nama" varchar(150) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "fakultas_kode_unique" UNIQUE("kode"),
	CONSTRAINT "fakultas_kode_nonblank_check" CHECK ("fakultas"."kode" ~ '[^[:space:]]'),
	CONSTRAINT "fakultas_kode_canonical_check" CHECK ("fakultas"."kode" = upper("fakultas"."kode") AND "fakultas"."kode" !~ '^[[:space:]]|[[:space:]]$'),
	CONSTRAINT "fakultas_nama_nonblank_check" CHECK ("fakultas"."nama" ~ '[^[:space:]]')
);
--> statement-breakpoint
CREATE TABLE "jadwal_kuliah" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kelas_kuliah_id" uuid NOT NULL,
	"ruangan_id" uuid NOT NULL,
	"hari" smallint NOT NULL,
	"jam_mulai" time NOT NULL,
	"jam_selesai" time NOT NULL,
	CONSTRAINT "jadwal_kuliah_kelas_kuliah_id_hari_jam_mulai_jam_selesai_unique" UNIQUE("kelas_kuliah_id","hari","jam_mulai","jam_selesai"),
	CONSTRAINT "jadwal_kuliah_hari_range_check" CHECK ("jadwal_kuliah"."hari" BETWEEN 1 AND 7),
	CONSTRAINT "jadwal_kuliah_jam_range_check" CHECK ("jadwal_kuliah"."jam_mulai" < "jadwal_kuliah"."jam_selesai")
);
--> statement-breakpoint
CREATE TABLE "kelas_dosen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kelas_kuliah_id" uuid NOT NULL,
	"dosen_id" uuid NOT NULL,
	"is_koordinator" boolean DEFAULT false NOT NULL,
	CONSTRAINT "kelas_dosen_kelas_kuliah_id_dosen_id_unique" UNIQUE("kelas_kuliah_id","dosen_id")
);
--> statement-breakpoint
CREATE TABLE "kelas_kuliah" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"semester_id" uuid NOT NULL,
	"mata_kuliah_id" uuid NOT NULL,
	"program_studi_id" uuid NOT NULL,
	"nama_kelas" varchar(20) NOT NULL,
	"kapasitas" integer NOT NULL,
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	CONSTRAINT "kelas_kuliah_offering_unique" UNIQUE("semester_id","program_studi_id","mata_kuliah_id","nama_kelas"),
	CONSTRAINT "kelas_kuliah_nama_kelas_nonblank_check" CHECK ("kelas_kuliah"."nama_kelas" ~ '[^[:space:]]'),
	CONSTRAINT "kelas_kuliah_nama_kelas_canonical_check" CHECK ("kelas_kuliah"."nama_kelas" = upper("kelas_kuliah"."nama_kelas") AND "kelas_kuliah"."nama_kelas" !~ '^[[:space:]]|[[:space:]]$'),
	CONSTRAINT "kelas_kuliah_status_check" CHECK ("kelas_kuliah"."status" IN ('DRAFT', 'DIBUKA', 'DITUTUP', 'DIBATALKAN')),
	CONSTRAINT "kelas_kuliah_kapasitas_positive_check" CHECK ("kelas_kuliah"."kapasitas" > 0)
);
--> statement-breakpoint
CREATE TABLE "krs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mahasiswa_id" uuid NOT NULL,
	"semester_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"batas_sks" smallint NOT NULL,
	"diajukan_at" timestamp with time zone,
	"disetujui_at" timestamp with time zone,
	"disetujui_oleh" uuid,
	CONSTRAINT "krs_mahasiswa_id_semester_id_unique" UNIQUE("mahasiswa_id","semester_id"),
	CONSTRAINT "krs_status_check" CHECK ("krs"."status" IN ('DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN')),
	CONSTRAINT "krs_batas_sks_positive_check" CHECK ("krs"."batas_sks" > 0),
	CONSTRAINT "krs_approval_pair_check" CHECK (("krs"."disetujui_at" IS NULL) = ("krs"."disetujui_oleh" IS NULL)),
	CONSTRAINT "krs_status_timestamps_check" CHECK ((
      ("krs"."status" = 'DRAFT' AND "krs"."diajukan_at" IS NULL AND "krs"."disetujui_at" IS NULL AND "krs"."disetujui_oleh" IS NULL)
      OR ("krs"."status" IN ('DIAJUKAN', 'DITOLAK') AND "krs"."diajukan_at" IS NOT NULL AND "krs"."disetujui_at" IS NULL AND "krs"."disetujui_oleh" IS NULL)
      OR ("krs"."status" = 'DISETUJUI' AND "krs"."diajukan_at" IS NOT NULL AND "krs"."disetujui_at" IS NOT NULL AND "krs"."disetujui_oleh" IS NOT NULL)
      OR "krs"."status" = 'DIBATALKAN'
    ))
);
--> statement-breakpoint
CREATE TABLE "krs_detail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"krs_id" uuid NOT NULL,
	"kelas_kuliah_id" uuid NOT NULL,
	"status" varchar(12) DEFAULT 'AKTIF' NOT NULL,
	CONSTRAINT "krs_detail_krs_id_kelas_kuliah_id_unique" UNIQUE("krs_id","kelas_kuliah_id"),
	CONSTRAINT "krs_detail_status_check" CHECK ("krs_detail"."status" IN ('AKTIF', 'DIBATALKAN'))
);
--> statement-breakpoint
CREATE TABLE "kurikulum" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"program_studi_id" uuid NOT NULL,
	"kode" varchar(30) NOT NULL,
	"nama" varchar(150) NOT NULL,
	"tahun_berlaku" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "kurikulum_program_studi_id_kode_unique" UNIQUE("program_studi_id","kode"),
	CONSTRAINT "kurikulum_id_program_studi_id_unique" UNIQUE("id","program_studi_id"),
	CONSTRAINT "kurikulum_kode_nonblank_check" CHECK ("kurikulum"."kode" ~ '[^[:space:]]'),
	CONSTRAINT "kurikulum_kode_canonical_check" CHECK ("kurikulum"."kode" = upper("kurikulum"."kode") AND "kurikulum"."kode" !~ '^[[:space:]]|[[:space:]]$'),
	CONSTRAINT "kurikulum_nama_nonblank_check" CHECK ("kurikulum"."nama" ~ '[^[:space:]]'),
	CONSTRAINT "kurikulum_tahun_berlaku_range_check" CHECK ("kurikulum"."tahun_berlaku" BETWEEN 1900 AND 9999)
);
--> statement-breakpoint
CREATE TABLE "kurikulum_matkul" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kurikulum_id" uuid NOT NULL,
	"mata_kuliah_id" uuid NOT NULL,
	"semester_rekomendasi" smallint,
	"is_wajib" boolean DEFAULT true NOT NULL,
	CONSTRAINT "kurikulum_matkul_kurikulum_id_mata_kuliah_id_unique" UNIQUE("kurikulum_id","mata_kuliah_id"),
	CONSTRAINT "kurikulum_matkul_semester_rekomendasi_positive_check" CHECK ("kurikulum_matkul"."semester_rekomendasi" IS NULL OR "kurikulum_matkul"."semester_rekomendasi" > 0)
);
--> statement-breakpoint
CREATE TABLE "mahasiswa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"program_studi_id" uuid NOT NULL,
	"kurikulum_id" uuid NOT NULL,
	"nim" varchar(30) NOT NULL,
	"nama" varchar(150) NOT NULL,
	"angkatan" smallint NOT NULL,
	"status" varchar(16) DEFAULT 'AKTIF' NOT NULL,
	CONSTRAINT "mahasiswa_nim_unique" UNIQUE("nim"),
	CONSTRAINT "mahasiswa_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "mahasiswa_nim_nonblank_check" CHECK ("mahasiswa"."nim" ~ '[^[:space:]]'),
	CONSTRAINT "mahasiswa_nim_canonical_check" CHECK ("mahasiswa"."nim" = upper("mahasiswa"."nim") AND "mahasiswa"."nim" !~ '^[[:space:]]|[[:space:]]$'),
	CONSTRAINT "mahasiswa_nama_nonblank_check" CHECK ("mahasiswa"."nama" ~ '[^[:space:]]'),
	CONSTRAINT "mahasiswa_status_check" CHECK ("mahasiswa"."status" IN ('AKTIF', 'CUTI', 'LULUS', 'KELUAR', 'NONAKTIF')),
	CONSTRAINT "mahasiswa_angkatan_range_check" CHECK ("mahasiswa"."angkatan" BETWEEN 1900 AND 9999)
);
--> statement-breakpoint
CREATE TABLE "mata_kuliah" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kode" varchar(30) NOT NULL,
	"nama" varchar(150) NOT NULL,
	"sks" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "mata_kuliah_kode_unique" UNIQUE("kode"),
	CONSTRAINT "mata_kuliah_kode_nonblank_check" CHECK ("mata_kuliah"."kode" ~ '[^[:space:]]'),
	CONSTRAINT "mata_kuliah_kode_canonical_check" CHECK ("mata_kuliah"."kode" = upper("mata_kuliah"."kode") AND "mata_kuliah"."kode" !~ '^[[:space:]]|[[:space:]]$'),
	CONSTRAINT "mata_kuliah_nama_nonblank_check" CHECK ("mata_kuliah"."nama" ~ '[^[:space:]]'),
	CONSTRAINT "mata_kuliah_sks_positive_check" CHECK ("mata_kuliah"."sks" > 0)
);
--> statement-breakpoint
CREATE TABLE "program_studi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fakultas_id" uuid NOT NULL,
	"kode" varchar(20) NOT NULL,
	"nama" varchar(150) NOT NULL,
	"jenjang" varchar(12) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "program_studi_kode_unique" UNIQUE("kode"),
	CONSTRAINT "program_studi_kode_nonblank_check" CHECK ("program_studi"."kode" ~ '[^[:space:]]'),
	CONSTRAINT "program_studi_kode_canonical_check" CHECK ("program_studi"."kode" = upper("program_studi"."kode") AND "program_studi"."kode" !~ '^[[:space:]]|[[:space:]]$'),
	CONSTRAINT "program_studi_nama_nonblank_check" CHECK ("program_studi"."nama" ~ '[^[:space:]]'),
	CONSTRAINT "program_studi_jenjang_check" CHECK ("program_studi"."jenjang" IN ('D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3', 'PROFESI'))
);
--> statement-breakpoint
CREATE TABLE "ruangan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kode" varchar(30) NOT NULL,
	"nama" varchar(100) NOT NULL,
	"gedung" varchar(100),
	"kapasitas" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "ruangan_kode_unique" UNIQUE("kode"),
	CONSTRAINT "ruangan_kode_nonblank_check" CHECK ("ruangan"."kode" ~ '[^[:space:]]'),
	CONSTRAINT "ruangan_kode_canonical_check" CHECK ("ruangan"."kode" = upper("ruangan"."kode") AND "ruangan"."kode" !~ '^[[:space:]]|[[:space:]]$'),
	CONSTRAINT "ruangan_nama_nonblank_check" CHECK ("ruangan"."nama" ~ '[^[:space:]]'),
	CONSTRAINT "ruangan_gedung_nonblank_check" CHECK ("ruangan"."gedung" ~ '[^[:space:]]'),
	CONSTRAINT "ruangan_kapasitas_positive_check" CHECK ("ruangan"."kapasitas" > 0)
);
--> statement-breakpoint
CREATE TABLE "semester" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kode" varchar(5) NOT NULL,
	"nama" varchar(100) NOT NULL,
	"tahun_mulai" smallint NOT NULL,
	"jenis" varchar(8) NOT NULL,
	"tanggal_mulai" date NOT NULL,
	"tanggal_selesai" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "semester_kode_unique" UNIQUE("kode"),
	CONSTRAINT "semester_tahun_mulai_jenis_unique" UNIQUE("tahun_mulai","jenis"),
	CONSTRAINT "semester_kode_nonblank_check" CHECK ("semester"."kode" ~ '[^[:space:]]'),
	CONSTRAINT "semester_kode_canonical_check" CHECK ("semester"."kode" = upper("semester"."kode") AND "semester"."kode" !~ '^[[:space:]]|[[:space:]]$'),
	CONSTRAINT "semester_nama_nonblank_check" CHECK ("semester"."nama" ~ '[^[:space:]]'),
	CONSTRAINT "semester_jenis_check" CHECK ("semester"."jenis" IN ('GANJIL', 'GENAP')),
	CONSTRAINT "semester_tahun_mulai_range_check" CHECK ("semester"."tahun_mulai" BETWEEN 1900 AND 9998),
	CONSTRAINT "semester_tanggal_range_check" CHECK ("semester"."tanggal_mulai" <= "semester"."tanggal_selesai"),
	CONSTRAINT "semester_kode_matches_term_check" CHECK ("semester"."kode" = "semester"."tahun_mulai"::text || CASE "semester"."jenis" WHEN 'GANJIL' THEN '1' ELSE '2' END)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(16) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_nonblank_check" CHECK ("users"."email" ~ '[^[:space:]]'),
	CONSTRAINT "users_email_canonical_check" CHECK ("users"."email" = lower("users"."email") AND "users"."email" !~ '^[[:space:]]|[[:space:]]$'),
	CONSTRAINT "users_password_hash_nonblank_check" CHECK ("users"."password_hash" ~ '[^[:space:]]'),
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('ADMIN', 'AKADEMIK', 'DOSEN', 'MAHASISWA'))
);
--> statement-breakpoint
ALTER TABLE "dosen" ADD CONSTRAINT "dosen_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "dosen" ADD CONSTRAINT "dosen_program_studi_id_program_studi_id_fk" FOREIGN KEY ("program_studi_id") REFERENCES "public"."program_studi"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "jadwal_kuliah" ADD CONSTRAINT "jadwal_kuliah_kelas_kuliah_id_kelas_kuliah_id_fk" FOREIGN KEY ("kelas_kuliah_id") REFERENCES "public"."kelas_kuliah"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "jadwal_kuliah" ADD CONSTRAINT "jadwal_kuliah_ruangan_id_ruangan_id_fk" FOREIGN KEY ("ruangan_id") REFERENCES "public"."ruangan"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "kelas_dosen" ADD CONSTRAINT "kelas_dosen_kelas_kuliah_id_kelas_kuliah_id_fk" FOREIGN KEY ("kelas_kuliah_id") REFERENCES "public"."kelas_kuliah"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "kelas_dosen" ADD CONSTRAINT "kelas_dosen_dosen_id_dosen_id_fk" FOREIGN KEY ("dosen_id") REFERENCES "public"."dosen"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "kelas_kuliah" ADD CONSTRAINT "kelas_kuliah_semester_id_semester_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semester"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "kelas_kuliah" ADD CONSTRAINT "kelas_kuliah_mata_kuliah_id_mata_kuliah_id_fk" FOREIGN KEY ("mata_kuliah_id") REFERENCES "public"."mata_kuliah"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "kelas_kuliah" ADD CONSTRAINT "kelas_kuliah_program_studi_id_program_studi_id_fk" FOREIGN KEY ("program_studi_id") REFERENCES "public"."program_studi"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "krs" ADD CONSTRAINT "krs_mahasiswa_id_mahasiswa_id_fk" FOREIGN KEY ("mahasiswa_id") REFERENCES "public"."mahasiswa"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "krs" ADD CONSTRAINT "krs_semester_id_semester_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semester"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "krs" ADD CONSTRAINT "krs_disetujui_oleh_users_id_fk" FOREIGN KEY ("disetujui_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "krs_detail" ADD CONSTRAINT "krs_detail_krs_id_krs_id_fk" FOREIGN KEY ("krs_id") REFERENCES "public"."krs"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "krs_detail" ADD CONSTRAINT "krs_detail_kelas_kuliah_id_kelas_kuliah_id_fk" FOREIGN KEY ("kelas_kuliah_id") REFERENCES "public"."kelas_kuliah"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "kurikulum" ADD CONSTRAINT "kurikulum_program_studi_id_program_studi_id_fk" FOREIGN KEY ("program_studi_id") REFERENCES "public"."program_studi"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "kurikulum_matkul" ADD CONSTRAINT "kurikulum_matkul_kurikulum_id_kurikulum_id_fk" FOREIGN KEY ("kurikulum_id") REFERENCES "public"."kurikulum"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "kurikulum_matkul" ADD CONSTRAINT "kurikulum_matkul_mata_kuliah_id_mata_kuliah_id_fk" FOREIGN KEY ("mata_kuliah_id") REFERENCES "public"."mata_kuliah"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "mahasiswa" ADD CONSTRAINT "mahasiswa_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "mahasiswa" ADD CONSTRAINT "mahasiswa_program_studi_id_program_studi_id_fk" FOREIGN KEY ("program_studi_id") REFERENCES "public"."program_studi"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "mahasiswa" ADD CONSTRAINT "mahasiswa_kurikulum_program_studi_fk" FOREIGN KEY ("kurikulum_id","program_studi_id") REFERENCES "public"."kurikulum"("id","program_studi_id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "program_studi" ADD CONSTRAINT "program_studi_fakultas_id_fakultas_id_fk" FOREIGN KEY ("fakultas_id") REFERENCES "public"."fakultas"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "dosen_program_studi_id_idx" ON "dosen" USING btree ("program_studi_id");--> statement-breakpoint
CREATE INDEX "jadwal_kuliah_ruangan_id_hari_jam_mulai_idx" ON "jadwal_kuliah" USING btree ("ruangan_id","hari","jam_mulai");--> statement-breakpoint
CREATE INDEX "kelas_dosen_dosen_id_idx" ON "kelas_dosen" USING btree ("dosen_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kelas_dosen_koordinator_unique" ON "kelas_dosen" USING btree ("kelas_kuliah_id") WHERE "kelas_dosen"."is_koordinator" = true;--> statement-breakpoint
CREATE INDEX "kelas_kuliah_mata_kuliah_id_idx" ON "kelas_kuliah" USING btree ("mata_kuliah_id");--> statement-breakpoint
CREATE INDEX "kelas_kuliah_program_studi_id_idx" ON "kelas_kuliah" USING btree ("program_studi_id");--> statement-breakpoint
CREATE INDEX "kelas_kuliah_semester_id_status_idx" ON "kelas_kuliah" USING btree ("semester_id","status");--> statement-breakpoint
CREATE INDEX "krs_semester_id_status_idx" ON "krs" USING btree ("semester_id","status");--> statement-breakpoint
CREATE INDEX "krs_disetujui_oleh_idx" ON "krs" USING btree ("disetujui_oleh");--> statement-breakpoint
CREATE INDEX "krs_detail_kelas_kuliah_id_status_idx" ON "krs_detail" USING btree ("kelas_kuliah_id","status");--> statement-breakpoint
CREATE INDEX "kurikulum_matkul_mata_kuliah_id_idx" ON "kurikulum_matkul" USING btree ("mata_kuliah_id");--> statement-breakpoint
CREATE INDEX "mahasiswa_program_studi_id_angkatan_idx" ON "mahasiswa" USING btree ("program_studi_id","angkatan");--> statement-breakpoint
CREATE INDEX "mahasiswa_kurikulum_id_idx" ON "mahasiswa" USING btree ("kurikulum_id");--> statement-breakpoint
CREATE INDEX "program_studi_fakultas_id_idx" ON "program_studi" USING btree ("fakultas_id");--> statement-breakpoint
CREATE UNIQUE INDEX "semester_active_unique" ON "semester" USING btree ("is_active") WHERE "semester"."is_active" = true;