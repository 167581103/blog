"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";

/**
 * TipTap BubbleMenu for links — official menu positioning,
 * thin UI for viewing/editing href + unlink.
 */
export function LinkBubbleMenu({ editor }: { editor: Editor | null }) {
  const [href, setHref] = useState("");

  useEffect(() => {
    if (!editor) return;

    function sync() {
      if (!editor) return;
      const next = editor.getAttributes("link").href;
      setHref(typeof next === "string" ? next : "");
    }

    sync();
    editor.on("selectionUpdate", sync);
    editor.on("transaction", sync);
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("transaction", sync);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: current }) =>
        current.isEditable && current.isActive("link")
      }
    >
      <div className="md-link-bubble">
        <input
          className="md-link-bubble-input"
          type="url"
          value={href}
          placeholder="https://"
          aria-label="Link URL"
          onChange={(event) => setHref(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyHref(editor, href);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              editor.commands.focus();
            }
          }}
          onBlur={() => applyHref(editor, href)}
        />
        <button
          type="button"
          className="md-link-bubble-unlink"
          onClick={() =>
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
          }
        >
          Unlink
        </button>
      </div>
    </BubbleMenu>
  );
}

function applyHref(editor: Editor, raw: string) {
  const next = raw.trim();
  const current = editor.getAttributes("link").href;
  if (!next) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  if (next === current) return;
  editor.chain().focus().extendMarkRange("link").setLink({ href: next }).run();
}
