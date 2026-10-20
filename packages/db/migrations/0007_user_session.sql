CREATE TABLE "user_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_digest" varchar(64) NOT NULL,
	"password_fingerprint" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_session_token_digest_unique" UNIQUE("token_digest"),
	CONSTRAINT "user_session_token_digest_check" CHECK ("user_session"."token_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "user_session_password_fingerprint_check" CHECK ("user_session"."password_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "user_session_user_id_idx" ON "user_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_session_expires_at_idx" ON "user_session" USING btree ("expires_at");