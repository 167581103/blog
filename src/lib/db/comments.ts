import { and, asc, eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/db";
import { comments, users } from "@/db/schema";
import { COMMENT_MAX_LENGTH } from "@/lib/db/constants";

export type CommentView = {
  id: string;
  articleSlug: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    login: string;
    name: string | null;
    image: string | null;
  };
};

export async function listComments(articleSlug: string): Promise<CommentView[]> {
  if (!isDbConfigured()) return [];

  const db = getDb();
  const rows = await db
    .select({
      id: comments.id,
      articleSlug: comments.articleSlug,
      body: comments.body,
      createdAt: comments.createdAt,
      authorId: users.id,
      authorLogin: users.login,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.articleSlug, articleSlug))
    .orderBy(asc(comments.createdAt));

  return rows.map((row) => ({
    id: row.id,
    articleSlug: row.articleSlug,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    author: {
      id: row.authorId,
      login: row.authorLogin,
      name: row.authorName,
      image: row.authorImage,
    },
  }));
}

export async function createComment(input: {
  articleSlug: string;
  userId: string;
  body: string;
}): Promise<CommentView> {
  const db = getDb();
  const body = input.body.trim();
  if (!body) throw new Error("Comment cannot be empty.");
  if (body.length > COMMENT_MAX_LENGTH) {
    throw new Error(`Comment must be at most ${COMMENT_MAX_LENGTH} characters.`);
  }

  const [row] = await db
    .insert(comments)
    .values({
      articleSlug: input.articleSlug,
      userId: input.userId,
      body,
    })
    .returning();

  if (!row) throw new Error("Failed to create comment.");

  const [author] = await db
    .select()
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!author) throw new Error("Author not found.");

  return {
    id: row.id,
    articleSlug: row.articleSlug,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    author: {
      id: author.id,
      login: author.login,
      name: author.name,
      image: author.image,
    },
  };
}

export async function deleteComment(input: {
  id: string;
  userId: string;
  isAdmin: boolean;
}): Promise<boolean> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, input.id))
    .limit(1);

  if (!existing) return false;
  if (!input.isAdmin && existing.userId !== input.userId) {
    throw new Error("Forbidden");
  }

  await db
    .delete(comments)
    .where(
      input.isAdmin
        ? eq(comments.id, input.id)
        : and(eq(comments.id, input.id), eq(comments.userId, input.userId)),
    );
  return true;
}
