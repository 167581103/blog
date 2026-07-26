"use client";

import { useState } from "react";
import { IconButton } from "./icon-button";
import { ShareIcon } from "./icons";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ url, title: document.title });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  }

  return (
    <IconButton label={copied ? "Copied" : "Share"} onClick={onShare}>
      <ShareIcon className="h-5 w-5" />
    </IconButton>
  );
}
