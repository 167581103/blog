"use client";

import { useState } from "react";
import { IconButton } from "./icon-button";
import { CheckIcon, LinkIcon } from "./icons";

/** Copy the current page URL — no system share sheet. */
export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function onCopyLink() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Legacy fallback for restricted clipboard contexts.
      const input = document.createElement("input");
      input.value = url;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <IconButton
      label={copied ? "Copied" : "Copy link"}
      onClick={onCopyLink}
    >
      {copied ? (
        <CheckIcon className="h-5 w-5" />
      ) : (
        <LinkIcon className="h-5 w-5" />
      )}
    </IconButton>
  );
}
