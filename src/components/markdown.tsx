"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

type Props = {
  content: string;
  className?: string;
};

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "figure"],
  attributes: {
    ...defaultSchema.attributes,
    img: [
      ...(defaultSchema.attributes?.img || []),
      "className",
      "class",
      "data-layout",
    ],
    figure: ["className", "class", "data-layout"],
    div: [
      ...(defaultSchema.attributes?.div || []),
      "className",
      "class",
      "data-type",
    ],
    a: [
      ...(defaultSchema.attributes?.a || []),
      "className",
      "class",
      "download",
      "data-filename",
      "data-size",
      "data-mime",
      "data-type",
    ],
  },
};

export function Markdown({ content, className }: Props) {
  return (
    <div className={className ?? "prose-blog"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
