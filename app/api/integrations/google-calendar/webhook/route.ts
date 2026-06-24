import { NextResponse } from "next/server";

import { runGoogleIncrementalSync } from "@/lib/google-calendar/sync";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const channelId = request.headers.get("x-goog-channel-id");
  const resourceId = request.headers.get("x-goog-resource-id");
  const resourceState = request.headers.get("x-goog-resource-state");
  const channelToken = request.headers.get("x-goog-channel-token");

  if (!channelId || !resourceId) {
    return NextResponse.json({ ok: true });
  }

  if (resourceState === "sync" || resourceState !== "exists") {
    return NextResponse.json({ ok: true });
  }

  const integration = channelToken
    ? await prisma.integration.findUnique({
        where: { id: channelToken },
      })
    : await prisma.integration.findFirst({
        where: {
          provider: "GOOGLE_CALENDAR",
          status: "CONNECTED",
          metadata: {
            path: ["watchChannelId"],
            equals: channelId,
          },
        },
      });

  if (!integration || integration.status !== "CONNECTED") {
    return NextResponse.json({ ok: true });
  }

  if (resourceId) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        metadata: {
          ...(integration.metadata as Record<string, unknown>),
          watchResourceId: resourceId,
        },
      },
    });
  }

  try {
    await runGoogleIncrementalSync(integration);
  } catch (error) {
    console.error("Google Calendar webhook sync failed:", error);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Google Calendar webhook endpoint" });
}
