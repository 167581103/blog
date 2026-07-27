import { cache } from "react";
import type { HomeContent } from "../types";
import {
  assertDocStoreConfigured,
  isDocStoreConfigured,
  readDoc,
  writeDoc,
} from "./docs";

const HOME_PATH = "site/home.json";

async function getHomeContentUncached(): Promise<HomeContent> {
  const fallback: HomeContent = {
    title: "Blog",
    content:
      "A quiet place for notes, thoughts, and things worth keeping.\n\nSign in to write or comment.",
    updatedAt: new Date(0).toISOString(),
  };

  if (!isDocStoreConfigured()) return fallback;

  try {
    const data = await readDoc<HomeContent>(HOME_PATH);
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

export const getHomeContent = cache(getHomeContentUncached);

export async function saveHomeContent(
  input: Pick<HomeContent, "title" | "content">,
): Promise<HomeContent> {
  assertDocStoreConfigured();
  const payload: HomeContent = {
    title: input.title.trim() || "Blog",
    content: input.content,
    updatedAt: new Date().toISOString(),
  };
  await writeDoc(HOME_PATH, payload);
  return payload;
}
