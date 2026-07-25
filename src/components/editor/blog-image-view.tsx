"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  LayoutCenterIcon,
  LayoutCompareIcon,
  LayoutInlineIcon,
} from "./layout-icons";

export type ImageLayout = "inline" | "center" | "compare";

export function BlogImageView({
  node,
  selected,
  updateAttributes,
  editor,
  getPos,
}: NodeViewProps) {
  const layout = (node.attrs.layout as ImageLayout) || "center";
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string) || "";

  function setLayout(next: ImageLayout) {
    if (next === "compare") {
      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos == null) return;
      editor
        .chain()
        .focus()
        .command(({ tr, dispatch }) => {
          if (!dispatch) return true;
          const compareType = editor.schema.nodes.imageCompare;
          if (!compareType) return false;
          const compare = compareType.create({
            srcLeft: src,
            srcRight: "",
            altLeft: alt,
            altRight: "",
          });
          tr.replaceWith(pos, pos + node.nodeSize, compare);
          return true;
        })
        .run();
      return;
    }
    updateAttributes({ layout: next });
  }

  return (
    <NodeViewWrapper
      as={layout === "inline" ? "span" : "div"}
      className={`blog-image blog-image--${layout}${selected ? " is-selected" : ""}`}
      data-drag-handle
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} draggable={false} />
      {selected ? (
        <div className="img-layout-bar" contentEditable={false}>
          <button
            type="button"
            className={layout === "inline" ? "is-active" : undefined}
            aria-label="Inline"
            title="Inline"
            onClick={() => setLayout("inline")}
          >
            <LayoutInlineIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={layout === "center" ? "is-active" : undefined}
            aria-label="Centered"
            title="Centered"
            onClick={() => setLayout("center")}
          >
            <LayoutCenterIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Side by side"
            title="Side by side"
            onClick={() => setLayout("compare")}
          >
            <LayoutCompareIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}
