import crypto from "crypto";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

function getStateSecret() {
  return process.env.AUTH_SECRET || "";
}

export function createGoogleCalendarOAuthState(
  agencyId: string,
  userId: string,
  returnOrigin: string,
  redirectUri: string,
) {
  const secret = getStateSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET is required for OAuth state");
  }

  const payload = Buffer.from(
    JSON.stringify({ agencyId, userId, returnOrigin, redirectUri, ts: Date.now() }),
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

export function verifyGoogleCalendarOAuthState(state: string) {
  const secret = getStateSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET is required for OAuth state");
  }

  const [payload, signature] = state.split(".");
  if (!payload || !signature) {
    throw new Error("Invalid OAuth state");
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  if (signature.length !== expected.length) {
    throw new Error("Invalid OAuth state signature");
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid OAuth state signature");
  }

  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    agencyId: string;
    userId: string;
    returnOrigin: string;
    redirectUri: string;
    ts: number;
  };

  if (Date.now() - data.ts > 10 * 60 * 1000) {
    throw new Error("OAuth state expired");
  }

  if (!data.returnOrigin || !data.redirectUri) {
    throw new Error("Invalid OAuth state");
  }

  return data;
}
