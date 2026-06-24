import { CustomersTable } from "@/components/customers/customers-table";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function CustomersPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const customerCount = await prisma.customer.count({
    where: { agencyId: user.agencyId },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <CustomersTable customerCount={customerCount} />
    </div>
  );
}
