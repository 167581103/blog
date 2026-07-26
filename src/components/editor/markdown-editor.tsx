"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import { mergeAttributes } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { BlogImage } from "./blog-image";
import { ImageCompare } from "./image-compare";
import { LinkUrlHint } from "./link-url-hint";

/** Underlined link mark that exposes the real href as title + data attribute. */
const EditorLink = Link.extend({
  renderHTML({ HTMLAttributes }) {
    const href =
      typeof HTMLAttributes.href === "string" ? HTMLAttributes.href : "";
    return [
      "a",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "md-link",
        title: href ? `Link → ${href}` : "Link",
        "data-href": href,
      }),
      0,
    ];
  },
});

type Props = {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  onUploadingChange?: (uploading: boolean) => void;
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

function replaceSrc(view: EditorView, from: string, to: string) {
  let tr = view.state.tr;
  let changed = false;
  view.state.doc.descendants((node, pos) => {
    if (node.type.name === "image" && node.attrs.src === from) {
      tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: to });
      changed = true;
    }
    if (node.type.name === "imageCompare") {
      const next = { ...node.attrs };
      if (next.srcLeft === from) next.srcLeft = to;
      if (next.srcRight === from) next.srcRight = to;
      if (next.srcLeft !== node.attrs.srcLeft || next.srcRight !== node.attrs.srcRight) {
        tr = tr.setNodeMarkup(pos, undefined, next);
        changed = true;
      }
    }
  });
  if (changed) view.dispatch(tr);
}

async function pasteOrDropImages(
  view: EditorView,
  files: File[],
  onUploadingChange?: (uploading: boolean) => void,
) {
  // Show local previews immediately, then swap to Blob URLs after upload.
  const locals = files.map((file) => ({
    file,
    src: URL.createObjectURL(file),
    alt: file.name,
  }));
  insertImages(
    view,
    locals.map((l) => ({ src: l.src, alt: l.alt })),
  );

  onUploadingChange?.(true);
  try {
    for (const local of locals) {
      try {
        const remote = await uploadFile(local.file);
        replaceSrc(view, local.src, remote);
      } catch {
        // keep local preview if upload fails
      } finally {
        URL.revokeObjectURL(local.src);
      }
    }
  } finally {
    onUploadingChange?.(false);
  }
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  onUploadingChange,
}: Props) {
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
      EditorLink.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        // Type/paste `[label](url)` → real link mark (not escaped plain text).
        markdownLinks: true,
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
        void pasteOrDropImages(view, files, onUploadingChange);
        return true;
      },
      handleDrop: (view, event) => {
        const files = collectImageFiles(event.dataTransfer?.files);
        if (!files.length) return false;
        event.preventDefault();
        void pasteOrDropImages(view, files, onUploadingChange);
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

  return (
    <div className="md-editor-wrap">
      <LinkUrlHint editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
