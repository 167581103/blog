"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

function formatSize(bytes: number) {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileAttachmentView({ node, selected }: NodeViewProps) {
  const href = (node.attrs.href as string) || "";
  const filename = (node.attrs.filename as string) || "file";
  const size = Number(node.attrs.size || 0);
  const sizeLabel = formatSize(size);

  return (
    <NodeViewWrapper
      className={`file-attachment-node${selected ? " is-selected" : ""}`}
      data-drag-handle
    >
      <a
        className="file-attachment"
        href={href || undefined}
        download={filename}
        onClick={(e) => {
          // Avoid navigating while editing; reader page uses real links.
          if (!href || href.startsWith("blob:")) e.preventDefault();
        }}
      >
        <span className="file-attachment-name">{filename}</span>
        {sizeLabel ? (
          <span className="file-attachment-meta">{sizeLabel}</span>
        ) : null}
      </a>
    </NodeViewWrapper>
  );
}
