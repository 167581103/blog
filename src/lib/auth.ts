import { cache } from "react";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { upsertUser } from "@/lib/db/users";

/**
 * Auth.js requires a full absolute URL. People often set AUTH_URL=chenguo.dev
 * (hostname only), which throws TypeError: Invalid URL and takes down every
 * page that calls auth() — including the public homepage.
 */
function normalizeAuthUrl() {
  const raw = process.env.AUTH_URL?.trim();
  if (!raw) return;
  if (/^https?:\/\//i.test(raw)) {
    process.env.AUTH_URL = raw.replace(/\/+$/, "");
    return;
  }
  process.env.AUTH_URL = `https://${raw.replace(/\/+$/, "")}`;
}

normalizeAuthUrl();

const adminUsername = process.env.ADMIN_GITHUB_USERNAME?.toLowerCase();

function isAdminLogin(login?: string | null) {
  return Boolean(login && adminUsername && login.toLowerCase() === adminUsername);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ profile }) {
      const login = (profile as { login?: string } | undefined)?.login;
      // Any GitHub account may sign in (comments). Admin gates stay on write APIs.
      return Boolean(login);
    },
    async jwt({ token, profile, account }) {
      if (profile) {
        const login = (profile as { login?: string }).login;
        const githubId =
          (profile as { id?: string | number }).id?.toString() ||
          account?.providerAccountId;

        token.login = login;
        token.githubId = githubId;
        token.isAdmin = isAdminLogin(login);

        if (githubId && login) {
          try {
            await upsertUser({
              id: githubId,
              login,
              name: profile.name ?? null,
              image: (profile as { image?: string | null }).image ??
                (profile as { avatar_url?: string | null }).avatar_url ??
                null,
            });
          } catch (error) {
            // DB may be offline during first deploy; session still works.
            console.error("[auth] upsertUser failed:", error);
          }
        }
      } else if (token.login && token.isAdmin === undefined) {
        token.isAdmin = isAdminLogin(token.login as string);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.login = token.login as string | undefined;
        session.user.githubId = token.githubId as string | undefined;
        session.user.isAdmin = Boolean(token.isAdmin);
      }
      return session;
    },
  },
  trustHost: true,
});

/** Any signed-in GitHub user (visitor or admin). */
export const requireUser = cache(async () => {
  try {
    const session = await auth();
    if (!session?.user?.login || !session.user.githubId) return null;
    return session;
  } catch (error) {
    console.error("[auth] requireUser failed:", error);
    return null;
  }
});

/** Blog owner only — write/edit/upload. */
export const requireAdmin = cache(async () => {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) return null;
    return session;
  } catch (error) {
    // Misconfigured AUTH_URL / AUTH_SECRET must not blank the public site.
    console.error("[auth] requireAdmin failed:", error);
    return null;
  }
});
