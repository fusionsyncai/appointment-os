import { randomUUID } from "crypto";

import type { Integration } from "@/generated/prisma/client";

import { getGoogleCalendarWebhookUrl } from "@/lib/app-url";
import { getCalendarApi } from "@/lib/google-calendar/client";
import type { GoogleCalendarMetadata } from "@/lib/google-calendar/client";
import { prisma } from "@/lib/prisma";

const WATCH_TTL_MS = 6 * 24 * 60 * 60 * 1000; // 6 days (Google max ~7 days for Calendar)

export async function startGoogleCalendarWatch(integration: Integration) {
  const calendar = await getCalendarApi(integration);
  const calendarId = integration.calendarId || "primary";
  const channelId = randomUUID();
  const watchToken = integration.id;
  const expiration = Date.now() + WATCH_TTL_MS;

  const response = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: getGoogleCalendarWebhookUrl(),
      token: watchToken,
      expiration: String(expiration),
    },
  });

  const metadata: GoogleCalendarMetadata = {
    ...((integration.metadata as GoogleCalendarMetadata | null) ?? {}),
    watchChannelId: response.data.id || channelId,
    watchResourceId: response.data.resourceId || undefined,
    watchExpiration: response.data.expiration
      ? new Date(Number(response.data.expiration)).toISOString()
      : new Date(expiration).toISOString(),
    watchToken,
  };

  await prisma.integration.update({
    where: { id: integration.id },
    data: { metadata },
  });

  return metadata;
}

export async function stopGoogleCalendarWatch(integration: Integration) {
  const metadata = (integration.metadata as GoogleCalendarMetadata | null) ?? {};

  if (!metadata.watchChannelId || !metadata.watchResourceId) {
    return;
  }

  try {
    const calendar = await getCalendarApi(integration);
    await calendar.channels.stop({
      requestBody: {
        id: metadata.watchChannelId,
        resourceId: metadata.watchResourceId,
      },
    });
  } catch {
    // Channel may already be expired or stopped.
  }

  const nextMetadata: GoogleCalendarMetadata = { ...metadata };
  delete nextMetadata.watchChannelId;
  delete nextMetadata.watchResourceId;
  delete nextMetadata.watchExpiration;
  delete nextMetadata.watchToken;

  await prisma.integration.update({
    where: { id: integration.id },
    data: { metadata: nextMetadata },
  });
}

export async function renewGoogleCalendarWatchIfNeeded(integration: Integration) {
  const metadata = (integration.metadata as GoogleCalendarMetadata | null) ?? {};

  if (!metadata.watchExpiration || !metadata.watchChannelId) {
    return metadata;
  }

  const expiresAt = new Date(metadata.watchExpiration).getTime();
  if (expiresAt - Date.now() > 24 * 60 * 60 * 1000) {
    return metadata;
  }

  await stopGoogleCalendarWatch(integration);
  const fresh = await prisma.integration.findUnique({ where: { id: integration.id } });
  if (!fresh) return metadata;

  return startGoogleCalendarWatch(fresh);
}

export function isWatchActive(metadata: GoogleCalendarMetadata | null | undefined) {
  if (!metadata?.watchExpiration || !metadata.watchChannelId) {
    return false;
  }

  return new Date(metadata.watchExpiration).getTime() > Date.now();
}
