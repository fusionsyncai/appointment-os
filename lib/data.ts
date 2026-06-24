import { prisma } from "@/lib/prisma";

export async function getAgencyDashboardData(agencyId: string) {
  const [customers, appointments, activities, agency] = await Promise.all([
    prisma.customer.findMany({ where: { agencyId }, orderBy: { createdAt: "desc" } }),
    prisma.appointment.findMany({
      where: { agencyId },
      include: { customer: true },
      orderBy: { startTime: "desc" },
    }),
    prisma.activity.findMany({ where: { agencyId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.agency.findUnique({ where: { id: agencyId } }),
  ]);

  return { customers, appointments, activities, agency };
}

export async function getAgencyCustomers(agencyId: string) {
  return prisma.customer.findMany({
    where: { agencyId },
    include: { appointments: { select: { id: true, startTime: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCustomerById(agencyId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: { id: customerId, agencyId },
    include: {
      appointments: { orderBy: { startTime: "desc" } },
    },
  });
}

export async function getAgencyAppointments(agencyId: string) {
  return prisma.appointment.findMany({
    where: { agencyId },
    include: { customer: true },
    orderBy: { startTime: "desc" },
  });
}

export async function getAgencyIntegrations(agencyId: string) {
  return prisma.integration.findMany({ where: { agencyId } });
}

export async function getAgencyTeam(agencyId: string) {
  return prisma.user.findMany({
    where: { agencyId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function logActivity(
  agencyId: string,
  data: {
    type: import("@/generated/prisma/client").ActivityType;
    description: string;
    entityId?: string;
    actorName?: string;
  },
) {
  return prisma.activity.create({ data: { agencyId, ...data } });
}
