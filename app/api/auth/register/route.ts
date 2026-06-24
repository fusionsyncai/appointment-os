import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  agencyName: z.string().min(2).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const agencyName =
      parsed.data.agencyName || `${parsed.data.name.split(" ")[0]}'s Agency`;
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const agency = await prisma.agency.create({
      data: { name: agencyName },
    });

    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash,
        agencyId: agency.id,
        role: "ADMIN",
      },
    });

    await prisma.activity.create({
      data: {
        agencyId: agency.id,
        type: "CUSTOMER_CREATED",
        description: "Workspace created",
        actorName: parsed.data.name,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
