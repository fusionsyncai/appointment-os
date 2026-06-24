import { NextResponse } from "next/server";
import { z } from "zod";

import { logActivity } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/session";

const updateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
  meetingLink: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser();
  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.appointment.findFirst({
    where: { id, agencyId: user.agencyId },
    include: { customer: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      ...parsed.data,
      startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : undefined,
      endTime: parsed.data.endTime ? new Date(parsed.data.endTime) : undefined,
    },
    include: { customer: true },
  });

  if (parsed.data.status === "CANCELLED") {
    await logActivity(user.agencyId, {
      type: "MEETING_CANCELLED",
      description: `Meeting "${appointment.title}" cancelled`,
      entityId: appointment.id,
      actorName: user.name || undefined,
    });
  }

  return NextResponse.json(appointment);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser();
  const { id } = await params;

  const existing = await prisma.appointment.findFirst({ where: { id, agencyId: user.agencyId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.appointment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
