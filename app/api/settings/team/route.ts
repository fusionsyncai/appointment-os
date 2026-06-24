import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSessionUser } from "@/lib/session";

export async function GET() {
  const user = await requireSessionUser();
  const team = await prisma.user.findMany({
    where: { agencyId: user.agencyId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(team);
}

const inviteSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  const user = await requireAdmin();
  const body = await request.json();
  const parsed = inviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const member = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      role: parsed.data.role,
      agencyId: user.agencyId,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json(member, { status: 201 });
}

const roleSchema = z.object({ role: z.enum(["ADMIN", "MEMBER"]) });

export async function PATCH(request: Request) {
  const user = await requireAdmin();
  const body = await request.json();
  const parsed = roleSchema.safeParse(body);

  if (!parsed.success || !body.userId) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (body.userId === user.id) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const member = await prisma.user.findFirst({
    where: { id: body.userId, agencyId: user.agencyId },
  });

  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id: member.id },
    data: { role: parsed.data.role },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const user = await requireAdmin();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId || userId === user.id) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const member = await prisma.user.findFirst({ where: { id: userId, agencyId: user.agencyId } });
  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ success: true });
}
