import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function databaseUrl() {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    ""
  );
}

export function isDbConfigured() {
  return Boolean(databaseUrl());
}

function createDb() {
  const url = databaseUrl();
  if (!url) {
    throw new Error(
      "Database is not configured. Set DATABASE_URL (Neon) on Vercel.",
    );
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

type Db = ReturnType<typeof createDb>;

let _db: Db | null = null;

/** Lazy — safe for `next build` before DATABASE_URL exists. */
export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}
