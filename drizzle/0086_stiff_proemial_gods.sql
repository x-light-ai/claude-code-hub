CREATE TABLE IF NOT EXISTS "key_relative_expiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"key_id" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "key_relative_expiries" ADD CONSTRAINT "key_relative_expiries_key_id_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_key_relative_expiries_key_id" ON "key_relative_expiries" USING btree ("key_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_key_relative_expiries_created_at" ON "key_relative_expiries" USING btree ("created_at");
