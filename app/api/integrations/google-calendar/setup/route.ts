import { NextResponse } from "next/server";

import { calendarOAuthCallbackUrl, getRequestOrigin } from "@/lib/app-url";
import { requireSessionUser } from "@/lib/session";

/** Returns the exact redirect URI + client ID to register in Google Cloud Console. */
export async function GET(request: Request) {
  await requireSessionUser();

  const origin = getRequestOrigin(request);
  const redirectUri = calendarOAuthCallbackUrl(origin);
  const clientId = process.env.GOOGLE_CLIENT_ID || null;

  return NextResponse.json({
    redirectUri,
    clientId,
    instructions:
      "In Google Cloud Console → Credentials, open the Web OAuth client with this exact Client ID. Add redirectUri under Authorized redirect URIs (not JavaScript origins).",
  });
}
