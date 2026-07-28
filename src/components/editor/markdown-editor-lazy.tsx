"use client";

import dynamic from "next/dynamic";

const MarkdownEditorInner = dynamic(
  () =>
    import("./markdown-editor").then((m) => ({ default: m.MarkdownEditor })),
  {
    ssr: false,
    loading: () => <p className="editor-status">Loading editor…</p>,
  },
);

type Props = {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  onUploadingChange?: (uploading: boolean) => void;
  onUploadError?: (message: string) => void;
};

/** TipTap is heavy — load only on editor routes. */
export function MarkdownEditorLazy(props: Props) {
  return <MarkdownEditorInner {...props} />;
}
