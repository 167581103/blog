"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";

type Props = {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
};

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || "Upload failed");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export function MarkdownEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { class: "editor-image" },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Write in markdown…",
      }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "md-editor",
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        const files: File[] = [];
        for (const item of items) {
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
              files.push(file);
            }
          }
        }

        if (!files.length) return false;

        event.preventDefault();
        void (async () => {
          for (const file of files) {
            try {
              const url = await uploadFile(file);
              const { schema } = view.state;
              if (file.type.startsWith("image/") && schema.nodes.image) {
                const node = schema.nodes.image.create({ src: url, alt: file.name });
                const tr = view.state.tr.replaceSelectionWith(node).scrollIntoView();
                view.dispatch(tr);
              } else {
                const text = schema.text(url);
                const tr = view.state.tr.replaceSelectionWith(text).scrollIntoView();
                view.dispatch(tr);
              }
            } catch {
              // keep writing even if one upload fails
            }
          }
        })();
        return true;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;

        const media = Array.from(files).filter(
          (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
        );
        if (!media.length) return false;

        event.preventDefault();
        void (async () => {
          for (const file of media) {
            try {
              const url = await uploadFile(file);
              if (file.type.startsWith("image/") && view.state.schema.nodes.image) {
                const node = view.state.schema.nodes.image.create({
                  src: url,
                  alt: file.name,
                });
                const tr = view.state.tr.replaceSelectionWith(node).scrollIntoView();
                view.dispatch(tr);
              }
            } catch {
              // ignore failed uploads
            }
          }
        })();
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      const storage = current.storage as {
        markdown?: { getMarkdown: () => string };
      };
      const markdown = storage.markdown?.getMarkdown() ?? current.getText();
      onChange(markdown);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const storage = editor.storage as {
      markdown?: { getMarkdown: () => string };
    };
    const current = storage.markdown?.getMarkdown() ?? "";
    if (value !== current) {
      editor.commands.setContent(value || "");
    }
  }, [editor, value]);

  return <EditorContent editor={editor} />;
}
