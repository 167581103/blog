-- Run once in Neon SQL Editor after connecting the DB to Vercel.
-- Safe to re-run only on an empty database.

CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"name" text,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_login_unique" UNIQUE("login")
);

CREATE TABLE IF NOT EXISTS "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_slug" text NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "article_tags" (
	"article_slug" text NOT NULL,
	"tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE cascade,
	CONSTRAINT "article_tags_article_slug_tag_id_pk" PRIMARY KEY("article_slug","tag_id")
);

CREATE TABLE IF NOT EXISTS "annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_slug" text NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"anchor" jsonb NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "comments_article_slug_created_idx"
  ON "comments" USING btree ("article_slug","created_at");
CREATE INDEX IF NOT EXISTS "annotations_article_slug_idx"
  ON "annotations" USING btree ("article_slug");
