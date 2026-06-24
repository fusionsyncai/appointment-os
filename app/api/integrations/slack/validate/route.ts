import { NextResponse } from "next/server";
import { z } from "zod";

import { validateSlackAccessToken } from "@/lib/slack/client";
import { requireAdmin } from "@/lib/session";

const bodySchema = z.object({
  accessToken: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Access token is required" }, { status: 400 });
    }

    const result = await validateSlackAccessToken(parsed.data.accessToken);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ team: result.team });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
