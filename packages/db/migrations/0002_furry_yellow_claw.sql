CREATE TABLE "hasil_studi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kelas_kuliah_id" uuid NOT NULL,
	"mahasiswa_id" uuid NOT NULL,
	"nilai_angka" numeric(5, 2) NOT NULL,
	"nilai_huruf" varchar(8) NOT NULL,
	"nilai_indeks" numeric(5, 2) NOT NULL,
	"difinalisasi_at" timestamp with time zone NOT NULL,
	"difinalisasi_oleh" uuid NOT NULL,
	"dikoreksi_at" timestamp with time zone,
	"dikoreksi_oleh" uuid,
	"alasan_koreksi" text,
	CONSTRAINT "hasil_studi_kelas_kuliah_id_mahasiswa_id_unique" UNIQUE("kelas_kuliah_id","mahasiswa_id"),
	CONSTRAINT "hasil_studi_nilai_angka_range_check" CHECK ("hasil_studi"."nilai_angka" >= 0 AND "hasil_studi"."nilai_angka" <= 100),
	CONSTRAINT "hasil_studi_nilai_indeks_nonnegative_check" CHECK ("hasil_studi"."nilai_indeks" >= 0),
	CONSTRAINT "hasil_studi_nilai_huruf_canonical_check" CHECK ("hasil_studi"."nilai_huruf" = upper(btrim("hasil_studi"."nilai_huruf")) AND "hasil_studi"."nilai_huruf" <> ''),
	CONSTRAINT "hasil_studi_koreksi_fields_check" CHECK ((
        "hasil_studi"."dikoreksi_at" IS NULL
        AND "hasil_studi"."dikoreksi_oleh" IS NULL
        AND "hasil_studi"."alasan_koreksi" IS NULL
      ) OR (
        "hasil_studi"."dikoreksi_at" IS NOT NULL
        AND "hasil_studi"."dikoreksi_oleh" IS NOT NULL
        AND "hasil_studi"."alasan_koreksi" IS NOT NULL
        AND btrim("hasil_studi"."alasan_koreksi") <> ''
      )),
	CONSTRAINT "hasil_studi_dikoreksi_at_range_check" CHECK ("hasil_studi"."dikoreksi_at" IS NULL OR "hasil_studi"."dikoreksi_at" >= "hasil_studi"."difinalisasi_at")
);
--> statement-breakpoint
CREATE TABLE "komponen_nilai" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kelas_kuliah_id" uuid NOT NULL,
	"nama" varchar(100) NOT NULL,
	"bobot" numeric(5, 2) NOT NULL,
	"urutan" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "komponen_nilai_bobot_range_check" CHECK ("komponen_nilai"."bobot" > 0 AND "komponen_nilai"."bobot" <= 100),
	CONSTRAINT "komponen_nilai_urutan_positive_check" CHECK ("komponen_nilai"."urutan" > 0),
	CONSTRAINT "komponen_nilai_nama_nonblank_check" CHECK ("komponen_nilai"."nama" ~ '[^[:space:]]')
);
--> statement-breakpoint
CREATE TABLE "nilai_mahasiswa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"komponen_nilai_id" uuid NOT NULL,
	"mahasiswa_id" uuid NOT NULL,
	"nilai" numeric(5, 2),
	"dicatat_oleh" uuid NOT NULL,
	"diubah_oleh" uuid NOT NULL,
	CONSTRAINT "nilai_mahasiswa_komponen_nilai_id_mahasiswa_id_unique" UNIQUE("komponen_nilai_id","mahasiswa_id"),
	CONSTRAINT "nilai_mahasiswa_nilai_range_check" CHECK ("nilai_mahasiswa"."nilai" IS NULL OR ("nilai_mahasiswa"."nilai" >= 0 AND "nilai_mahasiswa"."nilai" <= 100))
);
--> statement-breakpoint
ALTER TABLE "hasil_studi" ADD CONSTRAINT "hasil_studi_kelas_kuliah_id_kelas_kuliah_id_fk" FOREIGN KEY ("kelas_kuliah_id") REFERENCES "public"."kelas_kuliah"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "hasil_studi" ADD CONSTRAINT "hasil_studi_mahasiswa_id_mahasiswa_id_fk" FOREIGN KEY ("mahasiswa_id") REFERENCES "public"."mahasiswa"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "hasil_studi" ADD CONSTRAINT "hasil_studi_difinalisasi_oleh_users_id_fk" FOREIGN KEY ("difinalisasi_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "hasil_studi" ADD CONSTRAINT "hasil_studi_dikoreksi_oleh_users_id_fk" FOREIGN KEY ("dikoreksi_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "komponen_nilai" ADD CONSTRAINT "komponen_nilai_kelas_kuliah_id_kelas_kuliah_id_fk" FOREIGN KEY ("kelas_kuliah_id") REFERENCES "public"."kelas_kuliah"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "nilai_mahasiswa" ADD CONSTRAINT "nilai_mahasiswa_komponen_nilai_id_komponen_nilai_id_fk" FOREIGN KEY ("komponen_nilai_id") REFERENCES "public"."komponen_nilai"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "nilai_mahasiswa" ADD CONSTRAINT "nilai_mahasiswa_mahasiswa_id_mahasiswa_id_fk" FOREIGN KEY ("mahasiswa_id") REFERENCES "public"."mahasiswa"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "nilai_mahasiswa" ADD CONSTRAINT "nilai_mahasiswa_dicatat_oleh_users_id_fk" FOREIGN KEY ("dicatat_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "nilai_mahasiswa" ADD CONSTRAINT "nilai_mahasiswa_diubah_oleh_users_id_fk" FOREIGN KEY ("diubah_oleh") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "hasil_studi_mahasiswa_id_kelas_kuliah_id_idx" ON "hasil_studi" USING btree ("mahasiswa_id","kelas_kuliah_id");--> statement-breakpoint
CREATE UNIQUE INDEX "komponen_nilai_active_nama_unique" ON "komponen_nilai" USING btree ("kelas_kuliah_id",lower(btrim("nama"))) WHERE "komponen_nilai"."is_active" = true;--> statement-breakpoint
CREATE INDEX "komponen_nilai_kelas_kuliah_id_is_active_urutan_id_idx" ON "komponen_nilai" USING btree ("kelas_kuliah_id","is_active","urutan","id");--> statement-breakpoint
CREATE INDEX "nilai_mahasiswa_mahasiswa_id_komponen_nilai_id_idx" ON "nilai_mahasiswa" USING btree ("mahasiswa_id","komponen_nilai_id");