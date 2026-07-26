"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

/** Shows the real href when the caret sits inside a link mark. */
export function LinkUrlHint({ editor }: { editor: Editor | null }) {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) return;

    function sync() {
      if (!editor) return;
      const { href: next } = editor.getAttributes("link") as { href?: string };
      setHref(typeof next === "string" && next ? next : null);
    }

    sync();
    editor.on("selectionUpdate", sync);
    editor.on("transaction", sync);
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("transaction", sync);
    };
  }, [editor]);

  if (!href) return null;

  return (
    <p className="md-link-hint" title={href}>
      <span className="md-link-hint-label">Link</span>
      <span className="md-link-hint-url">{href}</span>
    </p>
  );
}
