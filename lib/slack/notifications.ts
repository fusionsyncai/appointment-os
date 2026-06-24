import { AppointmentStatus } from "@/generated/prisma/client";

import { decrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { sendSlackChannelMessage } from "@/lib/slack/client";

type SlackMetadata = {
  defaultChannelName?: string;
};

type AppointmentNotification = {
  title: string;
  startTime: Date;
  endTime: Date;
  customerName: string;
  meetingLink?: string | null;
  status?: AppointmentStatus;
};

function formatAppointmentTime(startTime: Date, endTime: Date) {
  const date = startTime.toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const start = startTime.toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
  });
  const end = endTime.toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${date} · ${start} – ${end}`;
}

function buildAppointmentBookedMessage(appointment: AppointmentNotification) {
  const lines = [
    "*New appointment booked*",
    `*${appointment.title}*`,
    `Customer: ${appointment.customerName}`,
    `When: ${formatAppointmentTime(appointment.startTime, appointment.endTime)}`,
  ];

  if (appointment.meetingLink) {
    lines.push(`Meeting link: ${appointment.meetingLink}`);
  }

  return lines.join("\n");
}

export async function notifySlackAppointmentBooked(
  agencyId: string,
  appointment: AppointmentNotification,
) {
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return;
  }

  try {
    const integration = await prisma.integration.findUnique({
      where: {
        agencyId_provider: {
          agencyId,
          provider: "SLACK",
        },
      },
    });

    if (
      !integration ||
      integration.status !== "CONNECTED" ||
      !integration.accessToken ||
      !integration.selectedChannel
    ) {
      return;
    }

    const accessToken = decrypt(integration.accessToken);
    const metadata = (integration.metadata as SlackMetadata | null) ?? {};
    const channelLabel = metadata.defaultChannelName
      ? `#${metadata.defaultChannelName}`
      : "default channel";

    const result = await sendSlackChannelMessage({
      accessToken,
      channelId: integration.selectedChannel,
      text: buildAppointmentBookedMessage(appointment),
    });

    if (!result.success) {
      console.error(
        `[slack] failed to notify ${channelLabel} for agency ${agencyId}:`,
        result.message,
      );
    }
  } catch (error) {
    console.error("[slack] appointment notification failed:", error);
  }
}
