ALTER TABLE "providers" ADD COLUMN "last_health_checked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "providers" DROP CONSTRAINT "providers_type_check";
--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_type_check" CHECK ("providers"."type" in ('opensubtitles', 'xunlei'));
