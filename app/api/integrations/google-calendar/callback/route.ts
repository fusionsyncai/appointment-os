import { handleGoogleCalendarOAuthCallback } from "@/lib/google-calendar/callback-handler";

/** Legacy path — kept so older Google Console redirect URIs still work. */
export async function GET(request: Request) {
  return handleGoogleCalendarOAuthCallback(request);
}
