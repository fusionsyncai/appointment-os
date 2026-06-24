import { NextResponse } from "next/server";
import { z } from "zod";

import { logActivity } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/session";

const customerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const user = await requireSessionUser();
  const customers = await prisma.customer.findMany({
    where: { agencyId: user.agencyId },
    include: { _count: { select: { appointments: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(customers);
}

export async function POST(request: Request) {
  const user = await requireSessionUser();
  const body = await request.json();
  const parsed = customerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const customer = await prisma.customer.create({
    data: { ...parsed.data, agencyId: user.agencyId },
  });

  await logActivity(user.agencyId, {
    type: "CUSTOMER_CREATED",
    description: `Customer ${customer.firstName} ${customer.lastName} created`,
    entityId: customer.id,
    actorName: user.name || undefined,
  });

  return NextResponse.json(customer, { status: 201 });
}
