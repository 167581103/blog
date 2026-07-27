import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Structured store (Neon Postgres).
 * Holds identity, relational features, and — since the Blob store can be
 * blocked by quota — the JSON documents for articles, home, and categories.
 */

/**
 * Key-value JSON documents keyed by the logical Blob pathname
 * (e.g. `articles/my-post.json`), so both backends share one addressing scheme.
 */
export const documents = pgTable("documents", {
  path: text("path").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  /** GitHub numeric user id as string */
  id: text("id").primaryKey(),
  login: text("login").notNull().unique(),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleSlug: text("article_slug").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("comments_article_slug_created_idx").on(t.articleSlug, t.createdAt),
  ],
);

/** Future: article classification (articles themselves stay in Blob). */
export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const articleTags = pgTable(
  "article_tags",
  {
    articleSlug: text("article_slug").notNull(),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.articleSlug, t.tagId] })],
);

/** Future: inline annotations / highlights. */
export const annotations = pgTable(
  "annotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleSlug: text("article_slug").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Selection / range payload — shape TBD when annotations ship. */
    anchor: jsonb("anchor").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("annotations_article_slug_idx").on(t.articleSlug)],
);
