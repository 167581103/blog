"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";

/**
 * TipTap BubbleMenu for links — official menu positioning,
 * thin UI for viewing/editing href + unlink.
 */
export function LinkBubbleMenu({ editor }: { editor: Editor | null }) {
  const [href, setHref] = useState("");
  const editingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editor) return;

    function sync() {
      if (!editor || editingRef.current) return;
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
      shouldShow={({ editor: current }) => {
        if (!current.isEditable) return false;
        // Keep menu while the URL field is focused (editor blurs).
        if (editingRef.current) return true;
        return current.isActive("link");
      }}
    >
      <div
        className="md-link-bubble"
        onMouseDown={(event) => {
          // Keep ProseMirror selection; still allow the input to focus.
          if (event.target !== inputRef.current) {
            event.preventDefault();
          }
          event.stopPropagation();
        }}
      >
        <input
          ref={inputRef}
          className="md-link-bubble-input"
          type="text"
          inputMode="url"
          value={href}
          placeholder="/resume or https://…"
          aria-label="Link URL"
          onFocus={() => {
            editingRef.current = true;
          }}
          onChange={(event) => setHref(event.target.value)}
          onKeyDown={(event) => {
            // Don't let ProseMirror/TipTap keymaps steal keystrokes.
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              editingRef.current = false;
              applyHref(editor, href);
              editor.commands.focus();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              editingRef.current = false;
              const current = editor.getAttributes("link").href;
              setHref(typeof current === "string" ? current : "");
              editor.commands.focus();
            }
          }}
          onKeyUp={(event) => event.stopPropagation()}
          onBlur={() => {
            editingRef.current = false;
            applyHref(editor, href);
          }}
        />
        <button
          type="button"
          className="md-link-bubble-unlink"
          onClick={() => {
            editingRef.current = false;
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
          }}
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
  editor
    .chain()
    .focus()
    .extendMarkRange("link")
    .setLink({
      href: next,
      target: isInternalHref(next) ? null : "_blank",
    })
    .run();
}

function isInternalHref(href: string) {
  return /^(?:\/|#|\.\/|\.\.\/)/.test(href);
}
