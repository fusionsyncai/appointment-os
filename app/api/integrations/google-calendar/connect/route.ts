import { NextResponse } from "next/server";

import { calendarOAuthCallbackUrl, getRequestOrigin } from "@/lib/app-url";
import { getGoogleAuthUrl } from "@/lib/google-calendar/client";
import { createGoogleCalendarOAuthState } from "@/lib/google-calendar/oauth-state";
import { requireAdmin } from "@/lib/session";

export async function GET(request: Request) {
  const origin = getRequestOrigin(request);

  try {
    const user = await requireAdmin();
    const redirectUri = calendarOAuthCallbackUrl(origin);
    const state = createGoogleCalendarOAuthState(
      user.agencyId,
      user.id,
      origin,
      redirectUri,
    );
    const authUrl = getGoogleAuthUrl(state, redirectUri);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Google OAuth";
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(message)}`, origin),
    );
  }
}
