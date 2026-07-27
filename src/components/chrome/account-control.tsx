"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/lib/auth-actions";

export type AccountUser = {
  login: string;
  image?: string | null;
};

type Props = {
  user: AccountUser | null;
  signInHref: string;
};

export function AccountControl({ user, signInHref }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) {
    return (
      <Link href={signInHref} className="read-bar-signin">
        Sign in
      </Link>
    );
  }

  const initial = user.login.slice(0, 1).toUpperCase();

  return (
    <div className="account-control" ref={rootRef}>
      <button
        type="button"
        className="account-avatar-btn icon-btn-motion"
        aria-label={`Account: ${user.login}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={`@${user.login}`}
        onClick={() => setOpen((value) => !value)}
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            width={28}
            height={28}
            className="account-avatar"
          />
        ) : (
          <span className="account-avatar account-avatar-fallback" aria-hidden>
            {initial}
          </span>
        )}
      </button>

      {open ? (
        <div id={menuId} className="account-menu" role="menu">
          <p className="account-menu-login">@{user.login}</p>
          <form action={signOut} role="none">
            <button type="submit" className="account-menu-item" role="menuitem">
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
