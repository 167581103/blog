"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { BlogImage } from "./blog-image";
import { ImageCompare } from "./image-compare";

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

function collectImageFiles(
  list: DataTransferItemList | FileList | undefined | null,
): File[] {
  if (!list) return [];
  const files: File[] = [];
  if (list instanceof FileList) {
    for (const file of Array.from(list)) {
      if (file.type.startsWith("image/")) files.push(file);
    }
    return files;
  }
  for (const item of list) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file?.type.startsWith("image/")) files.push(file);
    }
  }
  return files;
}

function insertImages(view: EditorView, urls: { src: string; alt: string }[]) {
  if (!urls.length) return;
  const { schema } = view.state;
  const image = schema.nodes.image;
  const compare = schema.nodes.imageCompare;
  if (!image) return;

  let tr = view.state.tr;
  if (urls.length >= 2 && compare) {
    const node = compare.create({
      srcLeft: urls[0].src,
      srcRight: urls[1].src,
      altLeft: urls[0].alt,
      altRight: urls[1].alt,
    });
    tr = tr.replaceSelectionWith(node).scrollIntoView();
    // remaining images as centered singles after
    let insertPos = tr.selection.to;
    for (const extra of urls.slice(2)) {
      const single = image.create({
        src: extra.src,
        alt: extra.alt,
        layout: "center",
      });
      tr = tr.insert(insertPos, single);
      insertPos += single.nodeSize;
    }
  } else {
    for (const item of urls) {
      const node = image.create({
        src: item.src,
        alt: item.alt,
        layout: "center",
      });
      tr = tr.replaceSelectionWith(node).scrollIntoView();
    }
  }
  view.dispatch(tr);
}

export function MarkdownEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      BlogImage.configure({
        allowBase64: false,
      }),
      ImageCompare,
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
        const files = collectImageFiles(event.clipboardData?.items);
        if (!files.length) return false;
        event.preventDefault();
        void (async () => {
          const uploaded: { src: string; alt: string }[] = [];
          for (const file of files) {
            try {
              const src = await uploadFile(file);
              uploaded.push({ src, alt: file.name });
            } catch {
              // skip failed upload
            }
          }
          insertImages(view, uploaded);
        })();
        return true;
      },
      handleDrop: (view, event) => {
        const files = collectImageFiles(event.dataTransfer?.files);
        if (!files.length) return false;
        event.preventDefault();
        void (async () => {
          const uploaded: { src: string; alt: string }[] = [];
          for (const file of files) {
            try {
              const src = await uploadFile(file);
              uploaded.push({ src, alt: file.name });
            } catch {
              // skip
            }
          }
          insertImages(view, uploaded);
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
