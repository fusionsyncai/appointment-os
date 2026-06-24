import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import type { JWT } from "next-auth/jwt";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import type { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

async function applyUserToToken(token: JWT, userId: string) {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, agencyId: true, role: true, name: true, email: true },
  });

  if (!dbUser) {
    return token;
  }

  token.sub = dbUser.id;
  token.agencyId = dbUser.agencyId;
  token.role = dbUser.role;
  token.name = dbUser.name;
  token.email = dbUser.email;

  return token;
}

function resolveEmail(
  user?: { email?: string | null },
  profile?: { email?: string | null },
  token?: JWT,
) {
  const email = user?.email ?? profile?.email ?? token?.email;
  return typeof email === "string" ? email.toLowerCase() : undefined;
}

async function applyUserToTokenByEmail(token: JWT, email: string) {
  const dbUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!dbUser) {
    return token;
  }

  return applyUserToToken(token, dbUser.id);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          agencyId: user.agencyId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "google" || !profile?.email) {
        return true;
      }

      const email = profile.email.toLowerCase();
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        const name = profile.name || email.split("@")[0];
        const agency = await prisma.agency.create({
          data: { name: `${name.split(" ")[0]}'s Agency` },
        });

        user = await prisma.user.create({
          data: {
            email,
            name,
            agencyId: agency.id,
            role: "ADMIN",
            image: typeof profile.picture === "string" ? profile.picture : undefined,
            emailVerified: new Date(),
          },
        });

        await prisma.activity.create({
          data: {
            agencyId: agency.id,
            type: "CUSTOMER_CREATED",
            description: "Workspace created",
            actorName: name,
          },
        });
      }

      if (account.providerAccountId) {
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          update: {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
          },
          create: {
            userId: user.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          },
        });
      }

      return true;
    },
    async jwt({ token, user, account, profile }) {
      const email = resolveEmail(user, profile, token);

      // OAuth providers pass Google's subject as user.id — always resolve via email.
      if (account?.provider === "google" && email) {
        return applyUserToTokenByEmail(token, email);
      }

      if (user?.id && account?.provider === "credentials") {
        return applyUserToToken(token, user.id);
      }

      if (email && !token.agencyId) {
        return applyUserToTokenByEmail(token, email);
      }

      if (token.sub && !token.agencyId) {
        return applyUserToToken(token, token.sub);
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
});
