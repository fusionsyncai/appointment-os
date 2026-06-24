import { auth } from "@/auth";
import { Role } from "@/generated/prisma/client";

export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id || !session.user.agencyId) {
    return null;
  }
  return session.user;
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireSessionUser();
  if (user.role !== Role.ADMIN) {
    throw new Error("Forbidden");
  }
  return user;
}
