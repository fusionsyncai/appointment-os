import { Role } from "@/generated/prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      agencyId: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    agencyId: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    agencyId: string;
    role: Role;
  }
}

export {};
