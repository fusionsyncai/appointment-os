import type { calendar_v3 } from "googleapis";

import { AppointmentStatus, type Integration } from "@/generated/prisma/client";

import { logActivity } from "@/lib/data";
import type { GoogleCalendarMetadata } from "@/lib/google-calendar/client";
import { getCalendarApi, getPrimaryCalendarEmail } from "@/lib/google-calendar/client";
import { renewGoogleCalendarWatchIfNeeded } from "@/lib/google-calendar/watch";
import { prisma } from "@/lib/prisma";
import { notifySlackAppointmentBooked } from "@/lib/slack/notifications";

type SyncResult = {
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
  processed: number;
};

type ParsedEvent = {
  event: calendar_v3.Schema$Event;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
};

const EMAIL_REGEX = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseEventTimes(event: calendar_v3.Schema$Event): ParsedEvent | null {
  if (!event.id) {
    return null;
  }

  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const startRaw = event.start?.dateTime ?? event.start?.date;
  const endRaw = event.end?.dateTime ?? event.end?.date;

  if (!startRaw || !endRaw) {
    return null;
  }

  return {
    event,
    startTime: new Date(startRaw),
    endTime: new Date(endRaw),
    allDay,
  };
}

function mapEventStatus(
  event: calendar_v3.Schema$Event,
  startTime: Date,
): AppointmentStatus {
  if (event.status === "cancelled") {
    return AppointmentStatus.CANCELLED;
  }

  if (startTime.getTime() < Date.now()) {
    return AppointmentStatus.COMPLETED;
  }

  return AppointmentStatus.SCHEDULED;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isCalendarOwnerEmail(email: string, calendarEmail: string) {
  return normalizeEmail(email) === normalizeEmail(calendarEmail);
}

function extractEmailsFromText(text: string | null | undefined) {
  if (!text) {
    return [];
  }

  return [...text.matchAll(EMAIL_REGEX)].map((match) => normalizeEmail(match[0]));
}

function resolveAttendeeEmail(
  event: calendar_v3.Schema$Event,
  calendarEmail: string,
) {
  const attendees = event.attendees ?? [];
  const seen = new Set<string>();

  for (const attendee of attendees) {
    if (!attendee.email) {
      continue;
    }

    const email = normalizeEmail(attendee.email);
    if (seen.has(email) || isCalendarOwnerEmail(email, calendarEmail)) {
      continue;
    }

    if (attendee.self) {
      continue;
    }

    return email;
  }

  for (const attendee of attendees) {
    if (!attendee.email) {
      continue;
    }

    const email = normalizeEmail(attendee.email);
    if (seen.has(email) || isCalendarOwnerEmail(email, calendarEmail)) {
      continue;
    }

    return email;
  }

  if (
    event.organizer?.email &&
    !isCalendarOwnerEmail(event.organizer.email, calendarEmail)
  ) {
    return normalizeEmail(event.organizer.email);
  }

  for (const email of extractEmailsFromText(event.description)) {
    if (!isCalendarOwnerEmail(email, calendarEmail)) {
      return email;
    }
  }

  return null;
}

function deriveCustomerName(email: string, displayName?: string | null) {
  if (displayName?.trim()) {
    const [firstName, ...rest] = displayName.trim().split(/\s+/);
    return {
      firstName: firstName || "Client",
      lastName: rest.join(" ") || "Contact",
      companyName: email.split("@")[1]?.split(".")[0] || "Unknown",
    };
  }

  const [local] = email.split("@");
  const [firstName, ...rest] = local.split(/[._-]/);

  return {
    firstName: firstName
      ? firstName.charAt(0).toUpperCase() + firstName.slice(1)
      : "Client",
    lastName: rest.length
      ? rest.join(" ").replace(/\b\w/g, (char) => char.toUpperCase())
      : "Contact",
    companyName: email.split("@")[1]?.split(".")[0] || "Unknown",
  };
}

function resolveAttendeeDisplayName(
  event: calendar_v3.Schema$Event,
  email: string,
) {
  const attendee = event.attendees?.find(
    (item) => item.email && normalizeEmail(item.email) === email,
  );

  return attendee?.displayName ?? null;
}

async function upsertCustomerFromEmail(
  agencyId: string,
  email: string,
  displayName?: string | null,
) {
  const normalized = normalizeEmail(email);
  const existing = await prisma.customer.findFirst({
    where: { agencyId, email: normalized },
  });

  if (existing) {
    return { customer: existing, created: false };
  }

  const derived = deriveCustomerName(normalized, displayName);
  const customer = await prisma.customer.create({
    data: {
      agencyId,
      email: normalized,
      firstName: derived.firstName,
      lastName: derived.lastName,
      companyName: derived.companyName,
    },
  });

  await logActivity(agencyId, {
    type: "CUSTOMER_CREATED",
    description: `Auto-created customer ${customer.firstName} ${customer.lastName} from calendar sync`,
    entityId: customer.id,
  });

  return { customer, created: true };
}

async function getOrCreateFallbackCustomer(agencyId: string) {
  const email = `calendar-import+${agencyId}@appointments.local`;

  return upsertCustomerFromEmail(agencyId, email, "Calendar Guest");
}

async function resolveCustomerForEvent(
  agencyId: string,
  event: calendar_v3.Schema$Event,
  calendarEmail: string,
) {
  const attendeeEmail = resolveAttendeeEmail(event, calendarEmail);

  if (attendeeEmail) {
    return upsertCustomerFromEmail(
      agencyId,
      attendeeEmail,
      resolveAttendeeDisplayName(event, attendeeEmail),
    );
  }

  return getOrCreateFallbackCustomer(agencyId);
}

async function cancelAppointmentFromEvent(agencyId: string, googleEventId: string) {
  const existing = await prisma.appointment.findFirst({
    where: { agencyId, googleEventId },
  });

  if (!existing || existing.status === AppointmentStatus.CANCELLED) {
    return { cancelled: false };
  }

  await prisma.appointment.update({
    where: { id: existing.id },
    data: { status: AppointmentStatus.CANCELLED },
  });

  await logActivity(agencyId, {
    type: "MEETING_CANCELLED",
    description: "Calendar event cancelled",
    entityId: existing.id,
  });

  return { cancelled: true };
}

async function upsertAppointmentFromEvent(
  agencyId: string,
  customerId: string,
  parsed: ParsedEvent,
) {
  const { event, startTime, endTime } = parsed;

  if (!event.id) {
    return { created: false, updated: false };
  }

  const status = mapEventStatus(event, startTime);
  const title = event.summary || "Calendar meeting";
  const description = event.description || null;
  const meetingLink = event.hangoutLink || event.htmlLink || null;

  const existing = await prisma.appointment.findFirst({
    where: { agencyId, googleEventId: event.id },
  });

  if (existing) {
    await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        customerId,
        title,
        description,
        startTime,
        endTime,
        status,
        meetingLink,
      },
    });

    return { created: false, updated: true };
  }

  await prisma.appointment.create({
    data: {
      agencyId,
      customerId,
      googleEventId: event.id,
      title,
      description,
      startTime,
      endTime,
      status,
      meetingLink,
    },
  });

  await logActivity(agencyId, {
    type: status === AppointmentStatus.CANCELLED ? "MEETING_CANCELLED" : "MEETING_BOOKED",
    description: `Synced "${title}" from Google Calendar`,
  });

  if (status !== AppointmentStatus.CANCELLED) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (customer) {
      void notifySlackAppointmentBooked(agencyId, {
        title,
        startTime,
        endTime,
        customerName: `${customer.firstName} ${customer.lastName}`,
        meetingLink,
        status,
      });
    }
  }

  return { created: true, updated: false };
}

async function applyCalendarEvent(
  integration: Integration,
  rawEvent: calendar_v3.Schema$Event,
  calendarEmail: string,
) {
  const parsed = parseEventTimes(rawEvent);
  if (!parsed) {
    return { created: false, updated: false, cancelled: false, skipped: true };
  }

  if (rawEvent.status === "cancelled") {
    const result = await cancelAppointmentFromEvent(
      integration.agencyId,
      rawEvent.id!,
    );
    return {
      created: false,
      updated: false,
      cancelled: result.cancelled,
      skipped: !result.cancelled,
    };
  }

  const { customer } = await resolveCustomerForEvent(
    integration.agencyId,
    rawEvent,
    calendarEmail,
  );

  const result = await upsertAppointmentFromEvent(
    integration.agencyId,
    customer.id,
    parsed,
  );

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      lastActivityDate: parsed.startTime,
    },
  });

  return {
    created: result.created,
    updated: result.updated,
    cancelled: false,
    skipped: false,
  };
}

async function applyCalendarEvents(
  integration: Integration,
  events: calendar_v3.Schema$Event[],
  calendarEmail: string,
) {
  const result: SyncResult = {
    created: 0,
    updated: 0,
    cancelled: 0,
    skipped: 0,
    processed: events.length,
  };

  for (const event of events) {
    const applied = await applyCalendarEvent(integration, event, calendarEmail);
    if (applied.created) result.created += 1;
    if (applied.updated) result.updated += 1;
    if (applied.cancelled) result.cancelled += 1;
    if (applied.skipped) result.skipped += 1;
  }

  return result;
}

async function getCalendarEmail(integration: Integration, metadata: GoogleCalendarMetadata) {
  return metadata.calendarEmail || (await getPrimaryCalendarEmail(integration));
}

async function saveSyncState(
  integration: Integration,
  metadata: GoogleCalendarMetadata,
  calendarEmail: string,
  syncToken: string | null | undefined,
  result: SyncResult,
  initial = false,
) {
  const updatedIntegration = await prisma.integration.update({
    where: { id: integration.id },
    data: {
      lastSyncAt: new Date(),
      totalSynced: integration.totalSynced + result.created,
      metadata: {
        ...metadata,
        calendarEmail,
        syncToken: syncToken ?? metadata.syncToken,
        initialSyncAt: initial
          ? new Date().toISOString()
          : metadata.initialSyncAt ?? new Date().toISOString(),
      },
    },
  });

  await renewGoogleCalendarWatchIfNeeded(updatedIntegration);
  return updatedIntegration;
}

export async function runGoogleInitialSync(integration: Integration) {
  const calendar = await getCalendarApi(integration);
  const calendarId = integration.calendarId || "primary";
  const metadata = (integration.metadata as GoogleCalendarMetadata | null) ?? {};
  const calendarEmail = await getCalendarEmail(integration, metadata);
  const timeMin = startOfToday();

  const events: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;
  let syncToken: string | undefined;

  do {
    const response = await calendar.events.list({
      calendarId,
      singleEvents: true,
      orderBy: "startTime",
      timeMin: timeMin.toISOString(),
      showDeleted: true,
      maxResults: 250,
      pageToken,
    });

    for (const event of response.data.items ?? []) {
      if (event.status === "cancelled") {
        events.push(event);
        continue;
      }

      const parsed = parseEventTimes(event);
      if (parsed && parsed.endTime >= timeMin) {
        events.push(event);
      }
    }

    pageToken = response.data.nextPageToken || undefined;
    if (response.data.nextSyncToken) {
      syncToken = response.data.nextSyncToken;
    }
  } while (pageToken);

  const result = await applyCalendarEvents(integration, events, calendarEmail);
  await saveSyncState(integration, metadata, calendarEmail, syncToken, result, true);

  return result;
}

export async function runGoogleIncrementalSync(integration: Integration) {
  const metadata = (integration.metadata as GoogleCalendarMetadata | null) ?? {};

  if (!metadata.syncToken) {
    return runGoogleInitialSync(integration);
  }

  const calendar = await getCalendarApi(integration);
  const calendarId = integration.calendarId || "primary";
  const calendarEmail = await getCalendarEmail(integration, metadata);

  const events: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  try {
    do {
      const response = await calendar.events.list({
        calendarId,
        syncToken: metadata.syncToken,
        showDeleted: true,
        maxResults: 250,
        pageToken,
      });

      events.push(...(response.data.items ?? []));
      pageToken = response.data.nextPageToken || undefined;
      if (response.data.nextSyncToken) {
        nextSyncToken = response.data.nextSyncToken;
      }
    } while (pageToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      error && typeof error === "object" && "code" in error
        ? Number((error as { code?: number }).code)
        : undefined;

    if (status === 410 || message.includes("410")) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          metadata: {
            ...metadata,
            syncToken: undefined,
          },
        },
      });

      const fresh = await prisma.integration.findUniqueOrThrow({
        where: { id: integration.id },
      });
      return runGoogleInitialSync(fresh);
    }

    throw error;
  }

  const result = await applyCalendarEvents(integration, events, calendarEmail);
  await saveSyncState(
    integration,
    metadata,
    calendarEmail,
    nextSyncToken ?? metadata.syncToken,
    result,
  );

  return result;
}

/** Full re-sync from today — used on manual sync button. */
export async function syncGoogleCalendarEvents(integration: Integration) {
  return runGoogleInitialSync(integration);
}

export async function syncGoogleCalendarByIntegrationId(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || integration.status !== "CONNECTED") {
    throw new Error("Google Calendar integration not connected");
  }

  return runGoogleIncrementalSync(integration);
}

export async function syncGoogleCalendarForAgency(agencyId: string) {
  const integration = await prisma.integration.findUnique({
    where: {
      agencyId_provider: {
        agencyId,
        provider: "GOOGLE_CALENDAR",
      },
    },
  });

  if (!integration || integration.status !== "CONNECTED") {
    throw new Error("Google Calendar is not connected");
  }

  return runGoogleIncrementalSync(integration);
}

export async function disconnectGoogleCalendar(agencyId: string, actorName?: string) {
  const integration = await prisma.integration.findUnique({
    where: {
      agencyId_provider: {
        agencyId,
        provider: "GOOGLE_CALENDAR",
      },
    },
  });

  if (!integration) {
    return;
  }

  if (integration.status === "CONNECTED") {
    const { stopGoogleCalendarWatch } = await import("@/lib/google-calendar/watch");
    await stopGoogleCalendarWatch(integration);
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      status: "DISCONNECTED",
      accessToken: null,
      refreshToken: null,
      metadata: {},
    },
  });

  await logActivity(agencyId, {
    type: "INTEGRATION_DISCONNECTED",
    description: "Google Calendar disconnected",
    entityId: integration.id,
    actorName,
  });
}
