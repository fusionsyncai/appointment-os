import { NextResponse } from "next/server";
import { z } from "zod";

import { logActivity } from "@/lib/data";
import { encrypt, decrypt } from "@/lib/encryption";
import { disconnectGoogleCalendar, syncGoogleCalendarForAgency } from "@/lib/google-calendar/sync";
import { prisma } from "@/lib/prisma";
import {
  listSlackChannels,
  validateSlackAccessToken,
  validateSlackChannelSelection,
} from "@/lib/slack/client";
import { requireAdmin, requireSessionUser } from "@/lib/session";

const slackConnectSchema = z.object({
  accessToken: z.string().min(1),
  defaultChannel: z.string().min(1),
});

export async function GET() {
  const user = await requireSessionUser();
  const integrations = await prisma.integration.findMany({ where: { agencyId: user.agencyId } });
  return NextResponse.json(
    integrations.map((item) => ({
      ...item,
      accessToken: undefined,
      refreshToken: undefined,
    })),
  );
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  const body = await request.json();
  const action = body.action as "connect" | "disconnect" | "sync" | "updateChannel";
  const provider = body.provider as "GOOGLE_CALENDAR" | "SLACK";

  if (!provider) {
    return NextResponse.json({ error: "Provider required" }, { status: 400 });
  }

  if (action === "connect" && provider === "GOOGLE_CALENDAR") {
    return NextResponse.json(
      { error: "Use /api/integrations/google-calendar/connect for Google Calendar OAuth" },
      { status: 400 },
    );
  }

  if (action === "connect" && provider === "SLACK") {
    const parsed = slackConnectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Slack access token and default channel are required" },
        { status: 400 },
      );
    }

    const token = parsed.data.accessToken.trim();
    const validation = await validateSlackAccessToken(token);
    if (!validation.success) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    const channelValidation = await validateSlackChannelSelection(
      token,
      parsed.data.defaultChannel,
    );
    if (!channelValidation.success) {
      return NextResponse.json({ error: channelValidation.message }, { status: 400 });
    }

    const channelsResult = await listSlackChannels(token);
    if (!channelsResult.success) {
      return NextResponse.json({ error: channelsResult.message }, { status: 400 });
    }

    const data = {
      provider,
      status: "CONNECTED" as const,
      accessToken: encrypt(token),
      workspaceName: validation.team,
      selectedChannel: parsed.data.defaultChannel,
      metadata: {
        channels: channelsResult.channels,
        defaultChannelName: channelValidation.channelName,
      },
      connectedAt: new Date(),
      totalSynced: 0,
    };

    const integration = await prisma.integration.upsert({
      where: { agencyId_provider: { agencyId: user.agencyId, provider } },
      update: data,
      create: { agencyId: user.agencyId, ...data },
    });

    await logActivity(user.agencyId, {
      type: "INTEGRATION_CONNECTED",
      description: "Slack connected",
      entityId: integration.id,
      actorName: user.name || undefined,
    });

    return NextResponse.json({
      ...integration,
      accessToken: undefined,
      refreshToken: undefined,
    });
  }

  if (action === "disconnect" && provider === "GOOGLE_CALENDAR") {
    await disconnectGoogleCalendar(user.agencyId, user.name || undefined);
    return NextResponse.json({ success: true });
  }

  if (action === "disconnect" && provider === "SLACK") {
    const integration = await prisma.integration.findUnique({
      where: { agencyId_provider: { agencyId: user.agencyId, provider: "SLACK" } },
    });

    if (!integration) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: "DISCONNECTED",
        accessToken: null,
        refreshToken: null,
      },
    });

    await logActivity(user.agencyId, {
      type: "INTEGRATION_DISCONNECTED",
      description: "Slack disconnected",
      entityId: integration.id,
      actorName: user.name || undefined,
    });

    return NextResponse.json({ success: true });
  }

  if (action === "updateChannel") {
    const channelSchema = z.object({ channel: z.string().min(1) });
    const parsed = channelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    const integration = await prisma.integration.findUnique({
      where: { agencyId_provider: { agencyId: user.agencyId, provider: "SLACK" } },
    });

    if (!integration?.accessToken || integration.status !== "CONNECTED") {
      return NextResponse.json({ error: "Slack is not connected" }, { status: 404 });
    }

    const accessToken = decrypt(integration.accessToken);
    const channelValidation = await validateSlackChannelSelection(
      accessToken,
      parsed.data.channel,
    );

    if (!channelValidation.success) {
      return NextResponse.json({ error: channelValidation.message }, { status: 400 });
    }

    const updated = await prisma.integration.update({
      where: { id: integration.id },
      data: {
        selectedChannel: parsed.data.channel,
        metadata: {
          ...(integration.metadata as Record<string, unknown>),
          defaultChannelName: channelValidation.channelName,
        },
      },
    });

    return NextResponse.json({
      ...updated,
      accessToken: undefined,
      refreshToken: undefined,
    });
  }

  if (action === "sync" && provider === "GOOGLE_CALENDAR") {
    try {
      const result = await syncGoogleCalendarForAgency(user.agencyId);
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
