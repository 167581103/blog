"use client";

import Link from "next/link";

export function ReadTitle({
  title,
  editHref,
}: {
  title: string;
  editHref?: string;
}) {
  if (!editHref) {
    return <h1 className="read-title">{title}</h1>;
  }

  return (
    <Link href={editHref} className="read-title read-title-link" title="Edit">
      {title}
    </Link>
  );
}
