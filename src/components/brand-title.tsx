"use client";

import Link from "next/link";

export function BrandTitle({
  title,
  editHref,
}: {
  title: string;
  editHref?: string;
}) {
  if (!editHref) {
    return <h1 className="brand">{title}</h1>;
  }

  return (
    <Link href={editHref} className="brand brand-link" title="Edit home">
      {title}
    </Link>
  );
}
