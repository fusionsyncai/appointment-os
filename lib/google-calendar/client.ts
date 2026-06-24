import { google } from "googleapis";
import type { Integration } from "@/generated/prisma/client";

import { decrypt, encrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { GOOGLE_CALENDAR_SCOPES } from "@/lib/google-calendar/oauth-state";

export type GoogleCalendarMetadata = {
  watchChannelId?: string;
  watchResourceId?: string;
  watchExpiration?: string;
  watchToken?: string;
  tokenExpiry?: string;
  calendarEmail?: string;
  syncToken?: string;
  initialSyncAt?: string;
};

function getGoogleClientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured");
  }

  return { clientId, clientSecret };
}

export function createOAuth2Client(redirectUri: string) {
  const { clientId, clientSecret } = getGoogleClientConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Redirect URI is unused when refreshing tokens; placeholder satisfies the client constructor. */
function createOAuth2ClientForApi() {
  const { clientId, clientSecret } = getGoogleClientConfig();
  return new google.auth.OAuth2(clientId, clientSecret, "http://127.0.0.1");
}

export function getGoogleAuthUrl(state: string, redirectUri: string) {
  const oauth2 = createOAuth2Client(redirectUri);

  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_CALENDAR_SCOPES,
    state,
    redirect_uri: redirectUri,
  });
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const oauth2 = createOAuth2Client(redirectUri);
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.access_token) {
    throw new Error("Google did not return an access token");
  }

  return tokens;
}

export async function getAuthenticatedClient(integration: Integration) {
  if (!integration.accessToken) {
    throw new Error("Google Calendar is not connected");
  }

  const oauth2 = createOAuth2ClientForApi();
  const metadata = (integration.metadata as GoogleCalendarMetadata | null) ?? {};

  oauth2.setCredentials({
    access_token: decrypt(integration.accessToken),
    refresh_token: integration.refreshToken ? decrypt(integration.refreshToken) : undefined,
    expiry_date: metadata.tokenExpiry ? new Date(metadata.tokenExpiry).getTime() : undefined,
  });

  oauth2.on("tokens", async (tokens) => {
    if (!tokens.access_token) return;

    const nextMetadata: GoogleCalendarMetadata = {
      ...metadata,
      tokenExpiry: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : metadata.tokenExpiry,
    };

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token
          ? encrypt(tokens.refresh_token)
          : integration.refreshToken,
        metadata: nextMetadata,
      },
    });
  });

  return oauth2;
}

export async function getCalendarApi(integration: Integration) {
  const auth = await getAuthenticatedClient(integration);
  return google.calendar({ version: "v3", auth });
}

export async function getPrimaryCalendarEmail(integration: Integration) {
  const calendar = await getCalendarApi(integration);
  const response = await calendar.calendarList.get({ calendarId: "primary" });
  return response.data.id || "primary";
}
