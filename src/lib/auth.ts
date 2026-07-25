import { cache } from "react";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

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
  const session = await auth();
  const login = session?.user?.login?.toLowerCase();
  if (!session || !adminUsername || login !== adminUsername) {
    return null;
  }
  return session;
});
