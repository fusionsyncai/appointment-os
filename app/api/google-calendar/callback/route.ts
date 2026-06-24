import { handleGoogleCalendarOAuthCallback } from "@/lib/google-calendar/callback-handler";

export async function GET(request: Request) {
  return handleGoogleCalendarOAuthCallback(request);
}
