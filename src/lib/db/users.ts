import { eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/db";
import { users } from "@/db/schema";

export type UserRecord = {
  id: string;
  login: string;
  name: string | null;
  image: string | null;
};

export async function upsertUser(input: UserRecord): Promise<void> {
  if (!isDbConfigured()) return;

  const db = getDb();
  const now = new Date();
  await db
    .insert(users)
    .values({
      id: input.id,
      login: input.login,
      name: input.name,
      image: input.image,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        login: input.login,
        name: input.name,
        image: input.image,
        updatedAt: now,
      },
    });
}

export async function getUserById(id: string) {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}
