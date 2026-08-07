import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { BlogImageView } from "./blog-image-view";

export const BlogImage = Image.extend({
  name: "image",
  atom: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      layout: {
        default: "center",
        parseHTML: (element) =>
          element.getAttribute("data-layout") ||
          (element.classList.contains("blog-image--inline")
            ? "inline"
            : "center"),
        renderHTML: (attributes) => ({
          "data-layout": attributes.layout || "center",
        }),
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const layout = HTMLAttributes["data-layout"] || "center";
    const imgAttrs = { ...HTMLAttributes };
    delete imgAttrs["data-layout"];
    return [
      "figure",
      {
        class: `blog-image blog-image--${layout}`,
        "data-layout": layout,
      },
      ["img", { ...imgAttrs, class: "editor-image" }],
    ];
  },

  parseHTML() {
    return [
      {
        tag: "figure.blog-image",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const img = el.querySelector("img");
          if (!img) return false;
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt"),
            layout: el.getAttribute("data-layout") || "center",
          };
        },
      },
      {
        tag: "img[src]",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          if (el.closest(".img-compare")) return false;
          return {
            src: el.getAttribute("src"),
            alt: el.getAttribute("alt"),
            layout: el.getAttribute("data-layout") || "center",
          };
        },
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlogImageView);
  },
});
