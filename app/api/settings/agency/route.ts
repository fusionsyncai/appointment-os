import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSessionUser } from "@/lib/session";

const agencySchema = z.object({
  name: z.string().min(2),
  timezone: z.string().min(1),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

export async function GET() {
  const user = await requireSessionUser();
  const agency = await prisma.agency.findUnique({ where: { id: user.agencyId } });
  return NextResponse.json(agency);
}

export async function PATCH(request: Request) {
  const user = await requireAdmin();
  const body = await request.json();
  const parsed = agencySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const agency = await prisma.agency.update({
    where: { id: user.agencyId },
    data: {
      name: parsed.data.name,
      timezone: parsed.data.timezone,
      logoUrl: parsed.data.logoUrl || null,
    },
  });

  return NextResponse.json(agency);
}
