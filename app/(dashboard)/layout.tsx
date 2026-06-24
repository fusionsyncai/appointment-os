import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const agency = await prisma.agency.findUnique({
    where: { id: user.agencyId },
    select: { name: true },
  });

  return (
    <DashboardShell
      agencyName={agency?.name || "Agency"}
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
      }}
    >
      {children}
    </DashboardShell>
  );
}
