import { cache } from "react";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

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
      if (!adminUsername) return false;
      const login = (
        profile as { login?: string } | undefined
      )?.login?.toLowerCase();
      return Boolean(login && login === adminUsername);
    },
    async jwt({ token, profile }) {
      if (profile) {
        token.login = (profile as { login?: string }).login;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.login = token.login as string | undefined;
      }
      return session;
    },
  },
  trustHost: true,
});

/** Dedupe auth checks within a single RSC/request (metadata + page). */
export const requireAdmin = cache(async () => {
  try {
    const session = await auth();
    const login = session?.user?.login?.toLowerCase();
    if (!session || !adminUsername || login !== adminUsername) {
      return null;
    }
    return session;
  } catch (error) {
    // Misconfigured AUTH_URL / AUTH_SECRET must not blank the public site.
    console.error("[auth] requireAdmin failed:", error);
    return null;
  }
});
