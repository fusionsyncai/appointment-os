import { NextResponse } from "next/server";
import { z } from "zod";

import { logActivity } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/session";
import { notifySlackAppointmentBooked } from "@/lib/slack/notifications";

const appointmentSchema = z.object({
  customerId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
  meetingLink: z.string().optional(),
});

export async function GET() {
  const user = await requireSessionUser();
  const appointments = await prisma.appointment.findMany({
    where: { agencyId: user.agencyId },
    include: { customer: true },
    orderBy: { startTime: "desc" },
  });
  return NextResponse.json(appointments);
}

export async function POST(request: Request) {
  const user = await requireSessionUser();
  const body = await request.json();
  const parsed = appointmentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, agencyId: user.agencyId },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const appointment = await prisma.appointment.create({
    data: {
      agencyId: user.agencyId,
      customerId: parsed.data.customerId,
      title: parsed.data.title,
      description: parsed.data.description,
      startTime: new Date(parsed.data.startTime),
      endTime: new Date(parsed.data.endTime),
      status: parsed.data.status || "SCHEDULED",
      meetingLink: parsed.data.meetingLink,
    },
    include: { customer: true },
  });

  await prisma.customer.update({
    where: { id: customer.id },
    data: { lastActivityDate: appointment.startTime },
  });

  await logActivity(user.agencyId, {
    type: parsed.data.status === "CANCELLED" ? "MEETING_CANCELLED" : "MEETING_BOOKED",
    description: `Meeting "${appointment.title}" with ${customer.firstName} ${customer.lastName}`,
    entityId: appointment.id,
    actorName: user.name || undefined,
  });

  if (appointment.status !== "CANCELLED") {
    void notifySlackAppointmentBooked(user.agencyId, {
      title: appointment.title,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      customerName: `${customer.firstName} ${customer.lastName}`,
      meetingLink: appointment.meetingLink,
      status: appointment.status,
    });
  }

  return NextResponse.json(appointment, { status: 201 });
}
