"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Article } from "@/lib/types";

export function ArticleList({
  articles,
  isAdmin,
}: {
  articles: Article[];
  isAdmin: boolean;
}) {
  if (!articles.length) {
    return (
      <motion.p
        className="muted"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        No articles yet.
      </motion.p>
    );
  }

  return (
    <motion.ul
      className="article-list"
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.07 } },
      }}
    >
      {articles.map((article) => (
        <motion.li
          key={article.id}
          variants={{
            hidden: { opacity: 0, y: 8 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          <Link href={`/articles/${article.slug}`} className="article-link">
            <span>{article.title}</span>
            {isAdmin && article.status === "draft" ? (
              <span className="draft-tag">draft</span>
            ) : null}
          </Link>
        </motion.li>
      ))}
    </motion.ul>
  );
}
