import type { NextAuthConfig } from "next-auth";

import type { Role } from "@/generated/prisma/client";

/**
 * Edge-safe auth config used by middleware.
 * Database access lives in auth.ts only.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.agencyId = user.agencyId;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.agencyId = token.agencyId as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
