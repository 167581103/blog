"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import { NodeSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { mergeAttributes } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { BlogImage } from "./blog-image";
import { ImageCompare } from "./image-compare";
import { FileAttachment } from "./file-attachment";
import { LinkBubbleMenu } from "./link-bubble-menu";

function isInternalHref(href: string) {
  return /^(?:\/|#|\.\/|\.\.\/)/.test(href);
}

/** Link mark with Mod-k → TipTap BubbleMenu (create/edit), click selects the link. */
const EditorLink = Link.extend({
  addKeyboardShortcuts() {
    return {
      "Mod-k": () => {
        if (this.editor.isActive("link")) {
          return this.editor.commands.extendMarkRange("link");
        }
        const { empty } = this.editor.state.selection;
        if (empty) return false;
        // Start with a site path — relative hrefs are first-class here.
        return this.editor
          .chain()
          .focus()
          .extendMarkRange("link")
          .setLink({ href: "/", target: null })
          .run();
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const href =
      typeof HTMLAttributes.href === "string" ? HTMLAttributes.href : "";
    const internal = isInternalHref(href);
    return [
      "a",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "md-link",
        title: href || undefined,
        target: internal ? null : HTMLAttributes.target,
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

function collectFiles(
  list: DataTransferItemList | FileList | undefined | null,
): File[] {
  if (!list) return [];
  const files: File[] = [];
  if (list instanceof FileList) {
    for (const file of Array.from(list)) files.push(file);
    return files;
  }
  for (const item of list) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function findSelectedCompare(view: EditorView): {
  pos: number;
  node: ReturnType<EditorView["state"]["doc"]["nodeAt"]>;
} | null {
  const { selection } = view.state;
  if (
    selection instanceof NodeSelection &&
    selection.node.type.name === "imageCompare"
  ) {
    return { pos: selection.from, node: selection.node };
  }
  return null;
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
      if (
        next.srcLeft !== node.attrs.srcLeft ||
        next.srcRight !== node.attrs.srcRight
      ) {
        tr = tr.setNodeMarkup(pos, undefined, next);
        changed = true;
      }
    }
    if (node.type.name === "fileAttachment" && node.attrs.href === from) {
      tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, href: to });
      changed = true;
    }
  });
  if (changed) view.dispatch(tr);
}

/** Prefer filling an empty compare side over replacing the whole node. */
function fillCompareWithImages(
  view: EditorView,
  files: File[],
  onUploadingChange?: (uploading: boolean) => void,
): boolean {
  const selected = findSelectedCompare(view);
  if (!selected?.node || !files.length) return false;

  const images = files.filter(isImageFile);
  if (!images.length) return false;

  const { pos, node } = selected;
  let srcLeft = (node.attrs.srcLeft as string) || "";
  let srcRight = (node.attrs.srcRight as string) || "";
  let altLeft = (node.attrs.altLeft as string) || "";
  let altRight = (node.attrs.altRight as string) || "";

  const locals: { file: File; src: string; side: "left" | "right" }[] = [];

  for (const file of images) {
    const local = URL.createObjectURL(file);
    if (!srcRight) {
      srcRight = local;
      altRight = file.name;
      locals.push({ file, src: local, side: "right" });
    } else if (!srcLeft) {
      srcLeft = local;
      altLeft = file.name;
      locals.push({ file, src: local, side: "left" });
    } else {
      // Both filled — replace the right side (explicit "paste right" intent).
      srcRight = local;
      altRight = file.name;
      locals.push({ file, src: local, side: "right" });
      break;
    }
  }

  let tr = view.state.tr.setNodeMarkup(pos, undefined, {
    ...node.attrs,
    srcLeft,
    srcRight,
    altLeft,
    altRight,
  });
  tr = tr.setSelection(NodeSelection.create(tr.doc, pos));
  view.dispatch(tr);

  onUploadingChange?.(true);
  void (async () => {
    try {
      for (const local of locals) {
        try {
          const remote = await uploadFile(local.file);
          replaceSrc(view, local.src, remote);
        } catch {
          // keep preview
        } finally {
          URL.revokeObjectURL(local.src);
        }
      }
    } finally {
      onUploadingChange?.(false);
    }
  })();

  return true;
}

async function pasteOrDropImages(
  view: EditorView,
  files: File[],
  onUploadingChange?: (uploading: boolean) => void,
) {
  if (fillCompareWithImages(view, files, onUploadingChange)) return;

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

async function pasteOrDropFiles(
  view: EditorView,
  files: File[],
  onUploadingChange?: (uploading: boolean) => void,
) {
  const fileType = view.state.schema.nodes.fileAttachment;
  if (!fileType || !files.length) return;

  const locals = files.map((file) => ({
    file,
    href: URL.createObjectURL(file),
    filename: file.name || "file",
    size: file.size,
    mime: file.type || "",
  }));

  let tr = view.state.tr;
  for (const local of locals) {
    const node = fileType.create({
      href: local.href,
      filename: local.filename,
      size: local.size,
      mime: local.mime,
    });
    tr = tr.replaceSelectionWith(node).scrollIntoView();
  }
  view.dispatch(tr);

  onUploadingChange?.(true);
  try {
    for (const local of locals) {
      try {
        const remote = await uploadFile(local.file);
        replaceSrc(view, local.href, remote);
      } catch {
        // keep local
      } finally {
        URL.revokeObjectURL(local.href);
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
      FileAttachment,
      EditorLink.configure({
        openOnClick: false,
        enableClickSelection: true,
        autolink: true,
        linkOnPaste: true,
        markdownLinks: true,
        defaultProtocol: "https",
        // TipTap default already allows many relatives; be explicit for /path, #hash.
        isAllowedUri: (url, ctx) => {
          if (!url) return false;
          if (isInternalHref(url)) return true;
          return ctx.defaultValidate(url);
        },
        HTMLAttributes: {
          // Prefer same-tab for in-editor links; renderHTML overrides internals.
          rel: "noopener noreferrer",
          target: "_blank",
        },
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
        const files = collectFiles(event.clipboardData?.items);
        if (!files.length) return false;
        const images = files.filter(isImageFile);
        const others = files.filter((f) => !isImageFile(f));
        event.preventDefault();
        if (images.length) {
          void pasteOrDropImages(view, images, onUploadingChange);
        }
        if (others.length) {
          void pasteOrDropFiles(view, others, onUploadingChange);
        }
        return true;
      },
      handleDrop: (view, event) => {
        const files = collectFiles(event.dataTransfer?.files);
        if (!files.length) return false;
        const images = files.filter(isImageFile);
        const others = files.filter((f) => !isImageFile(f));
        event.preventDefault();
        if (images.length) {
          void pasteOrDropImages(view, images, onUploadingChange);
        }
        if (others.length) {
          void pasteOrDropFiles(view, others, onUploadingChange);
        }
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
      <EditorContent editor={editor} />
      <LinkBubbleMenu editor={editor} />
    </div>
  );
}
