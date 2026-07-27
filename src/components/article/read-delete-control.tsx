"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { DeleteControl } from "../chrome/delete-control";

/** Admin read-bar delete → soft trash, then home. */
export function ReadDeleteControl({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DeleteControl
      busy={pending}
      onConfirm={() => {
        startTransition(async () => {
          const res = await fetch(`/api/articles/${slug}`, { method: "DELETE" });
          if (!res.ok) return;
          router.replace("/");
          router.refresh();
        });
      }}
    />
  );
}
