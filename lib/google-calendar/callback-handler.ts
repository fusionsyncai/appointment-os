import { NextResponse } from "next/server";

import { logActivity } from "@/lib/data";
import { encrypt } from "@/lib/encryption";
import type { GoogleCalendarMetadata } from "@/lib/google-calendar/client";
import {
  exchangeCodeForTokens,
  getPrimaryCalendarEmail,
} from "@/lib/google-calendar/client";
import { verifyGoogleCalendarOAuthState } from "@/lib/google-calendar/oauth-state";
import { runGoogleInitialSync } from "@/lib/google-calendar/sync";
import {
  startGoogleCalendarWatch,
  stopGoogleCalendarWatch,
} from "@/lib/google-calendar/watch";
import { prisma } from "@/lib/prisma";

export async function handleGoogleCalendarOAuthCallback(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  let returnOrigin = new URL(request.url).origin;

  if (state) {
    try {
      returnOrigin = verifyGoogleCalendarOAuthState(state).returnOrigin;
    } catch {
      // Fall back to request origin for error redirects.
    }
  }

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(oauthError)}`, returnOrigin),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/integrations?error=missing_oauth_code", returnOrigin),
    );
  }

  try {
    const { agencyId, userId, redirectUri } = verifyGoogleCalendarOAuthState(state);
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    if (!tokens.refresh_token) {
      throw new Error(
        "Google did not return a refresh token. Disconnect the app in your Google Account and try again.",
      );
    }

    const existing = await prisma.integration.findUnique({
      where: {
        agencyId_provider: {
          agencyId,
          provider: "GOOGLE_CALENDAR",
        },
      },
    });

    if (existing?.status === "CONNECTED") {
      await stopGoogleCalendarWatch(existing);
    }

    const metadata: GoogleCalendarMetadata = {
      tokenExpiry: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : undefined,
    };

    const integration = await prisma.integration.upsert({
      where: {
        agencyId_provider: {
          agencyId,
          provider: "GOOGLE_CALENDAR",
        },
      },
      update: {
        status: "CONNECTED",
        accessToken: encrypt(tokens.access_token!),
        refreshToken: encrypt(tokens.refresh_token),
        calendarId: "primary",
        workspaceName: "Google Calendar",
        connectedAt: new Date(),
        metadata,
      },
      create: {
        agencyId,
        provider: "GOOGLE_CALENDAR",
        status: "CONNECTED",
        accessToken: encrypt(tokens.access_token!),
        refreshToken: encrypt(tokens.refresh_token),
        calendarId: "primary",
        workspaceName: "Google Calendar",
        connectedAt: new Date(),
        totalSynced: 0,
        metadata,
      },
    });

    const calendarEmail = await getPrimaryCalendarEmail(integration);

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        metadata: {
          ...metadata,
          calendarEmail,
        },
      },
    });

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    await logActivity(agencyId, {
      type: "INTEGRATION_CONNECTED",
      description: "Google Calendar connected",
      entityId: integration.id,
      actorName: actor?.name,
    });

    const freshIntegration = await prisma.integration.findUniqueOrThrow({
      where: { id: integration.id },
    });

    await runGoogleInitialSync(freshIntegration);
    await startGoogleCalendarWatch(freshIntegration);

    return NextResponse.redirect(new URL("/integrations?connected=google", returnOrigin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar connection failed";
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(message)}`, returnOrigin),
    );
  }
}
