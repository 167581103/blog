"use client";

import type { ClipboardEvent, DragEvent } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  LayoutCenterIcon,
  LayoutCompareIcon,
  LayoutInlineIcon,
} from "./layout-icons";

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed");
  const data = (await res.json()) as { url: string };
  return data.url;
}

export function ImageCompareView({
  node,
  selected,
  updateAttributes,
  editor,
  getPos,
}: NodeViewProps) {
  const srcLeft = (node.attrs.srcLeft as string) || "";
  const srcRight = (node.attrs.srcRight as string) || "";
  const altLeft = (node.attrs.altLeft as string) || "";
  const altRight = (node.attrs.altRight as string) || "";

  async function fillSide(side: "left" | "right", file: File) {
    const local = URL.createObjectURL(file);
    updateAttributes(
      side === "left"
        ? { srcLeft: local, altLeft: file.name }
        : { srcRight: local, altRight: file.name },
    );
    try {
      const url = await uploadFile(file);
      updateAttributes(
        side === "left"
          ? { srcLeft: url, altLeft: file.name }
          : { srcRight: url, altRight: file.name },
      );
    } catch {
      // keep local preview
    } finally {
      URL.revokeObjectURL(local);
    }
  }

  function takeImageFile(
    list: DataTransferItemList | FileList | undefined | null,
  ): File | null {
    if (!list) return null;
    if (list instanceof FileList) {
      for (const file of Array.from(list)) {
        if (file.type.startsWith("image/")) return file;
      }
      return null;
    }
    for (const item of list) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file?.type.startsWith("image/")) return file;
      }
    }
    return null;
  }

  function onPasteSide(side: "left" | "right", event: ClipboardEvent) {
    const file = takeImageFile(event.clipboardData?.items);
    if (!file) return;
    event.preventDefault();
    event.stopPropagation();
    void fillSide(side, file);
  }

  function onDropSide(side: "left" | "right", event: DragEvent) {
    const file = takeImageFile(event.dataTransfer?.files);
    if (!file) return;
    event.preventDefault();
    event.stopPropagation();
    void fillSide(side, file);
  }

  function toSingle(side: "left" | "right", layout: "inline" | "center") {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos == null) return;
    const src = side === "left" ? srcLeft : srcRight;
    const alt = side === "left" ? altLeft : altRight;
    if (!src) return;
    editor
      .chain()
      .focus()
      .command(({ tr, dispatch }) => {
        if (!dispatch) return true;
        const imageType = editor.schema.nodes.image;
        if (!imageType) return false;
        const image = imageType.create({ src, alt, layout });
        tr.replaceWith(pos, pos + node.nodeSize, image);
        return true;
      })
      .run();
  }

  return (
    <NodeViewWrapper
      className={`img-compare${selected ? " is-selected" : ""}`}
      data-drag-handle
    >
      <div className="img-compare-grid">
        <Slot
          src={srcLeft}
          alt={altLeft}
          label="paste left"
          onPaste={(e) => onPasteSide("left", e)}
          onDrop={(e) => onDropSide("left", e)}
        />
        <Slot
          src={srcRight}
          alt={altRight}
          label="paste right"
          onPaste={(e) => onPasteSide("right", e)}
          onDrop={(e) => onDropSide("right", e)}
        />
      </div>
      {selected ? (
        <div className="img-layout-bar" contentEditable={false}>
          <button
            type="button"
            aria-label="Inline"
            title="Inline"
            disabled={!srcLeft}
            onClick={() => toSingle("left", "inline")}
          >
            <LayoutInlineIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Centered"
            title="Centered"
            disabled={!srcLeft}
            onClick={() => toSingle("left", "center")}
          >
            <LayoutCenterIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="is-active"
            aria-label="Side by side"
            title="Side by side"
          >
            <LayoutCompareIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}

function Slot({
  src,
  alt,
  label,
  onPaste,
  onDrop,
}: {
  src: string;
  alt: string;
  label: string;
  onPaste: (e: ClipboardEvent) => void;
  onDrop: (e: DragEvent) => void;
}) {
  // Always keep a paste/drop target — filled sides can be replaced too.
  return (
    <div
      className={`img-compare-slot${src ? " has-image" : ""}`}
      tabIndex={0}
      onPaste={onPaste}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} draggable={false} />
      ) : (
        label
      )}
    </div>
  );
}
