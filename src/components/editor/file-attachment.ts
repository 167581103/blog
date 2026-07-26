import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FileAttachmentView } from "./file-attachment-view";

export const FileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      href: { default: "" },
      filename: { default: "file" },
      size: { default: 0 },
      mime: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a.file-attachment[href]',
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          return {
            href: el.getAttribute("href") || "",
            filename:
              el.getAttribute("data-filename") ||
              el.textContent?.trim() ||
              "file",
            size: Number(el.getAttribute("data-size") || 0),
            mime: el.getAttribute("data-mime") || "",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const href = (HTMLAttributes.href as string) || "";
    const filename = (HTMLAttributes.filename as string) || "file";
    const size = Number(HTMLAttributes.size || 0);
    const mime = (HTMLAttributes.mime as string) || "";
    return [
      "a",
      mergeAttributes({
        class: "file-attachment",
        href,
        download: filename,
        "data-filename": filename,
        "data-size": String(size || ""),
        "data-mime": mime,
        "data-type": "file-attachment",
      }),
      filename,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentView);
  },
});
