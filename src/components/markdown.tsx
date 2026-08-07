"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import {
  plainHeadingText,
  slugifyHeading,
} from "@/lib/markdown-headings";

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
    h1: [...(defaultSchema.attributes?.h1 || []), "id"],
    h2: [...(defaultSchema.attributes?.h2 || []), "id"],
    h3: [...(defaultSchema.attributes?.h3 || []), "id"],
  },
};

function headingComponents(): Partial<Components> {
  const used = new Set<string>();

  function makeHeading(Tag: "h1" | "h2" | "h3"): Components["h1"] {
    function Heading({ children, ...props }: { children?: React.ReactNode }) {
      const text = plainHeadingText(
        Array.isArray(children)
          ? children.map(childToText).join("")
          : childToText(children),
      );
      const id = text ? slugifyHeading(text, used) : undefined;
      return (
        <Tag id={id} {...props}>
          {children}
        </Tag>
      );
    }
    Heading.displayName = `Markdown${Tag.toUpperCase()}`;
    return Heading;
  }

  return {
    h1: makeHeading("h1"),
    h2: makeHeading("h2"),
    h3: makeHeading("h3"),
  };
}

function childToText(child: unknown): string {
  if (child == null || typeof child === "boolean") return "";
  if (typeof child === "string" || typeof child === "number") {
    return String(child);
  }
  if (Array.isArray(child)) return child.map(childToText).join("");
  if (typeof child === "object" && child !== null && "props" in child) {
    const props = (child as { props?: { children?: unknown } }).props;
    return childToText(props?.children);
  }
  return "";
}

export function Markdown({ content, className }: Props) {
  const components = headingComponents();

  return (
    <div className={className ?? "prose-blog"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
