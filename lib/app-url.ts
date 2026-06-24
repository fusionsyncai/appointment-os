/**
 * NEXT_PUBLIC_APP_URL is ONLY used to register the Google Calendar
 * push notification webhook (events.watch). Everything else uses the request host.
 */
export function getGoogleCalendarWebhookUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL;

  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL is required for Google Calendar event webhooks");
  }

  return `${url.replace(/\/$/, "")}/api/integrations/google-calendar/webhook`;
}

export function getRequestOrigin(request: Request) {
  return new URL(request.url).origin;
}

export function calendarOAuthCallbackUrl(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/google-calendar/callback`;
}
