"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PinIcon } from "../chrome/icons";

/** Toggle pin-within-column from the admin homepage list. */
export function ArticlePinButton({
  slug,
  pinned,
}: {
  slug: string;
  pinned: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(pinned);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setValue(pinned);
  }, [pinned]);

  async function toggle() {
    const next = !value;
    setValue(next);
    try {
      const res = await fetch(`/api/articles/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: next }),
      });
      if (!res.ok) {
        setValue(!next);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setValue(!next);
    }
  }

  return (
    <button
      type="button"
      className={`article-pin-btn${value ? " is-pinned" : ""}`}
      aria-label={value ? "Unpin from column top" : "Pin to column top"}
      title={value ? "Unpin" : "Pin to top"}
      aria-pressed={value}
      disabled={pending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggle();
      }}
    >
      <PinIcon className="h-3.5 w-3.5" />
    </button>
  );
}
