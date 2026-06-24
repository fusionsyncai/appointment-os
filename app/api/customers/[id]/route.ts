import { NextResponse } from "next/server";
import { z } from "zod";

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

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser();
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, agencyId: user.agencyId },
    include: { appointments: { orderBy: { startTime: "desc" } } },
  });

  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(customer);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser();
  const { id } = await params;
  const body = await request.json();
  const parsed = customerSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.customer.findFirst({ where: { id, agencyId: user.agencyId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const customer = await prisma.customer.update({ where: { id }, data: parsed.data });
  return NextResponse.json(customer);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser();
  const { id } = await params;

  const existing = await prisma.customer.findFirst({ where: { id, agencyId: user.agencyId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
