import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageCompareView } from "./image-compare-view";

export const ImageCompare = Node.create({
  name: "imageCompare",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      srcLeft: { default: "" },
      srcRight: { default: "" },
      altLeft: { default: "" },
      altRight: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.img-compare",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const imgs = el.querySelectorAll("img");
          return {
            srcLeft: imgs[0]?.getAttribute("src") || "",
            srcRight: imgs[1]?.getAttribute("src") || "",
            altLeft: imgs[0]?.getAttribute("alt") || "",
            altRight: imgs[1]?.getAttribute("alt") || "",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const left = (HTMLAttributes.srcLeft as string) || "";
    const right = (HTMLAttributes.srcRight as string) || "";
    const altLeft = (HTMLAttributes.altLeft as string) || "";
    const altRight = (HTMLAttributes.altRight as string) || "";

    const children: [string, Record<string, string>][] = [];
    if (left) children.push(["img", { src: left, alt: altLeft }]);
    if (right) children.push(["img", { src: right, alt: altRight }]);

    return [
      "div",
      mergeAttributes({
        class: "img-compare",
        "data-type": "image-compare",
      }),
      ...children,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageCompareView);
  },
});
