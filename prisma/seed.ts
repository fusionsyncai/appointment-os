import {
  ActivityType,
  AppointmentStatus,
  IntegrationProvider,
  IntegrationStatus,
  Role,
} from "@/generated/prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "../lib/prisma";

const firstNames = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn",
  "Blake", "Drew", "Harper", "Reese", "Skyler", "Emerson", "Finley", "Hayden",
  "Jamie", "Kendall", "Logan", "Parker",
];

const lastNames = [
  "Chen", "Patel", "Nguyen", "Brooks", "Foster", "Hayes", "Kim", "Lopez",
  "Murphy", "Reed", "Shaw", "Turner", "Vega", "Walsh", "Young", "Zhang",
  "Adams", "Clark", "Evans", "Gray",
];

const companies = [
  "Northwind Digital", "Bright Co", "Pixel Studio", "Summit Labs", "Horizon Media",
  "Atlas Growth", "Nova Creative", "Echo Partners", "Vertex SEO", "Pulse Analytics",
  "Clearview Agency", "Meridian Brands", "Signal House", "Catalyst Co", "Foundry Group",
  "Lumen Works", "Trailhead Marketing", "Bluepeak", "Ironwood", "Silverline",
];

const titles = [
  "Discovery Call", "Strategy Review", "Campaign Kickoff", "Monthly Check-in",
  "Proposal Walkthrough", "Onboarding Session", "Performance Review", "Creative Brief",
  "Budget Planning", "Quarterly Business Review",
];

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function main() {
  await prisma.activity.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.agency.deleteMany();

  const agency = await prisma.agency.create({
    data: {
      name: "Demo Agency",
      timezone: "America/New_York",
    },
  });

  const passwordHash = await bcrypt.hash("password123", 12);

  const admin = await prisma.user.create({
    data: {
      name: "Demo Admin",
      email: "admin@demo.agency",
      passwordHash,
      role: Role.ADMIN,
      agencyId: agency.id,
    },
  });

  await prisma.user.create({
    data: {
      name: "Demo Member",
      email: "member@demo.agency",
      passwordHash,
      role: Role.MEMBER,
      agencyId: agency.id,
    },
  });

  const customers = await Promise.all(
    Array.from({ length: 20 }, (_, index) => {
      const firstName = firstNames[index];
      const lastName = lastNames[index];
      return prisma.customer.create({
        data: {
          agencyId: agency.id,
          firstName,
          lastName,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${companies[index].split(" ")[0].toLowerCase()}.com`,
          phone: `+1 (555) ${String(100 + index).padStart(3, "0")}-${String(1000 + index).slice(-4)}`,
          companyName: companies[index],
          notes: index % 3 === 0 ? "Key account — prefers morning meetings." : null,
          lastActivityDate: addDays(new Date(), -index),
        },
      });
    }),
  );

  const now = new Date();
  const appointments = [];

  for (let index = 0; index < 50; index += 1) {
    const customer = customers[index % customers.length];
    const dayOffset = index < 20 ? index + 1 : -(index - 20);
    const startTime = addDays(now, dayOffset);
    startTime.setHours(9 + (index % 6), (index % 2) * 30, 0, 0);
    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + 1);

    let status: AppointmentStatus = AppointmentStatus.SCHEDULED;
    if (dayOffset < 0) {
      status = index % 5 === 0 ? AppointmentStatus.CANCELLED : AppointmentStatus.COMPLETED;
    }

    appointments.push(
      await prisma.appointment.create({
        data: {
          agencyId: agency.id,
          customerId: customer.id,
          title: randomItem(titles),
          description: "Discuss campaign performance and next steps.",
          startTime,
          endTime,
          status,
          meetingLink: "https://meet.google.com/demo-meeting",
          googleEventId: index % 4 === 0 ? `google_event_${index}` : null,
        },
      }),
    );
  }

  await prisma.integration.createMany({
    data: [
      {
        agencyId: agency.id,
        provider: IntegrationProvider.GOOGLE_CALENDAR,
        status: IntegrationStatus.CONNECTED,
        calendarId: "primary",
        workspaceName: "Demo Google Calendar",
        connectedAt: addDays(now, -14),
        lastSyncAt: addDays(now, -1),
        totalSynced: 12,
      },
      {
        agencyId: agency.id,
        provider: IntegrationProvider.SLACK,
        status: IntegrationStatus.CONNECTED,
        workspaceName: "Demo Slack Workspace",
        selectedChannel: "marketing",
        metadata: { channels: ["general", "marketing", "sales", "random", "announcements"] },
        connectedAt: addDays(now, -10),
        totalSynced: 0,
      },
    ],
  });

  await prisma.activity.createMany({
    data: [
      {
        agencyId: agency.id,
        type: ActivityType.CUSTOMER_CREATED,
        description: "Workspace created",
        actorName: admin.name,
      },
      ...customers.slice(0, 5).map((customer) => ({
        agencyId: agency.id,
        type: ActivityType.CUSTOMER_CREATED,
        description: `Customer ${customer.firstName} ${customer.lastName} created`,
        entityId: customer.id,
        actorName: admin.name,
      })),
      ...appointments.slice(0, 8).map((appointment) => ({
        agencyId: agency.id,
        type:
          appointment.status === AppointmentStatus.CANCELLED
            ? ActivityType.MEETING_CANCELLED
            : ActivityType.MEETING_BOOKED,
        description: `Meeting "${appointment.title}" ${appointment.status === AppointmentStatus.CANCELLED ? "cancelled" : "booked"}`,
        entityId: appointment.id,
        actorName: admin.name,
      })),
      {
        agencyId: agency.id,
        type: ActivityType.INTEGRATION_CONNECTED,
        description: "Google Calendar connected successfully",
        actorName: admin.name,
      },
      {
        agencyId: agency.id,
        type: ActivityType.INTEGRATION_CONNECTED,
        description: 'Slack workspace "Demo Slack Workspace" connected',
        actorName: admin.name,
      },
    ],
  });

  console.log("Seed complete");
  console.log("Login: admin@demo.agency / password123");
  console.log(`Agency: ${agency.name}`);
  console.log(`Customers: ${customers.length}, Appointments: ${appointments.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
